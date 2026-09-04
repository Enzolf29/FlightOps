import { app } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import forge from 'node-forge'

export interface TabletCertificateBundle {
  privateKeyPem: string
  certificatePem: string
  caCertificateDer: Buffer
  caFingerprint: string
}

function serialNumber(): string {
  // Les certificats X.509 attendent un entier positif : le premier octet est limité à 7 bits.
  const bytes = randomBytes(16)
  bytes[0] &= 0x7f
  return bytes.toString('hex')
}

function certificateDirectory(): string {
  return join(app.getPath('userData'), 'tablet-pwa-certificates')
}

function loadOrCreateCa(): { certificate: forge.pki.Certificate; privateKey: forge.pki.rsa.PrivateKey } {
  const directory = certificateDirectory()
  const certPath = join(directory, 'flightops-local-ca.pem')
  const keyPath = join(directory, 'flightops-local-ca-key.pem')
  mkdirSync(directory, { recursive: true })

  if (existsSync(certPath) && existsSync(keyPath)) {
    return {
      certificate: forge.pki.certificateFromPem(readFileSync(certPath, 'utf8')),
      privateKey: forge.pki.privateKeyFromPem(readFileSync(keyPath, 'utf8'))
    }
  }

  const keys = forge.pki.rsa.generateKeyPair(2048)
  const certificate = forge.pki.createCertificate()
  certificate.publicKey = keys.publicKey
  certificate.serialNumber = serialNumber()
  certificate.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)
  certificate.validity.notAfter = new Date()
  certificate.validity.notAfter.setFullYear(certificate.validity.notAfter.getFullYear() + 10)
  const attributes = [
    { name: 'commonName', value: 'FlightOps Local CA' },
    { name: 'organizationName', value: 'FlightOps' }
  ]
  certificate.setSubject(attributes)
  certificate.setIssuer(attributes)
  certificate.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, digitalSignature: true },
    { name: 'subjectKeyIdentifier' }
  ])
  certificate.sign(keys.privateKey, forge.md.sha256.create())

  writeFileSync(certPath, forge.pki.certificateToPem(certificate), { encoding: 'utf8', mode: 0o600 })
  writeFileSync(keyPath, forge.pki.privateKeyToPem(keys.privateKey), { encoding: 'utf8', mode: 0o600 })
  return { certificate, privateKey: keys.privateKey }
}

function loadOrCreateServerKeys(): forge.pki.rsa.KeyPair {
  const directory = certificateDirectory()
  const certPath = join(directory, 'flightops-tablet-key.pem')
  if (existsSync(certPath)) {
    const privateKey = forge.pki.privateKeyFromPem(readFileSync(certPath, 'utf8'))
    return { privateKey, publicKey: forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e) }
  }
  const keys = forge.pki.rsa.generateKeyPair(2048)
  writeFileSync(certPath, forge.pki.privateKeyToPem(keys.privateKey), { encoding: 'utf8', mode: 0o600 })
  return keys
}

export function createTabletCertificate(addresses: string[]): TabletCertificateBundle {
  const ca = loadOrCreateCa()
  const serverKeys = loadOrCreateServerKeys()
  const certificate = forge.pki.createCertificate()
  certificate.publicKey = serverKeys.publicKey
  certificate.serialNumber = serialNumber()
  certificate.validity.notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)
  certificate.validity.notAfter = new Date()
  certificate.validity.notAfter.setFullYear(certificate.validity.notAfter.getFullYear() + 2)
  certificate.setSubject([
    { name: 'commonName', value: addresses[0] ?? 'localhost' },
    { name: 'organizationName', value: 'FlightOps' }
  ])
  certificate.setIssuer(ca.certificate.subject.attributes)
  certificate.setExtensions([
    { name: 'basicConstraints', cA: false },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true },
    { name: 'subjectAltName', altNames: [
      { type: 2, value: 'localhost' },
      { type: 7, ip: '127.0.0.1' },
      ...addresses.map((address) => ({ type: 7, ip: address }))
    ] },
    { name: 'subjectKeyIdentifier' }
  ])
  certificate.sign(ca.privateKey, forge.md.sha256.create())

  const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(ca.certificate)).getBytes()
  const caCertificateDer = Buffer.from(derBytes, 'binary')
  const caFingerprint = createHash('sha256').update(caCertificateDer).digest('hex').toUpperCase().match(/.{1,2}/g)?.join(':') ?? ''

  return {
    privateKeyPem: forge.pki.privateKeyToPem(serverKeys.privateKey),
    certificatePem: forge.pki.certificateToPem(certificate) + forge.pki.certificateToPem(ca.certificate),
    caCertificateDer,
    caFingerprint
  }
}
