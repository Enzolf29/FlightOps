# Publier une nouvelle version de FlightOps

## Prérequis GitHub (une seule fois)

1. Les utilisateurs doivent pouvoir lire les Releases. Rendre ce dépôt public ou remplacer le
   dépôt configuré dans `app/electron-builder.yml` par un dépôt public dédié aux binaires.
2. Dans **Settings → Pages**, sélectionner **GitHub Actions** comme source.
3. Dans **Settings → Actions → General**, autoriser les workflows et conserver les permissions
   définies dans les fichiers du dépôt.
4. Facultatif mais recommandé : ajouter les secrets `WINDOWS_CERTIFICATE` (certificat PFX encodé
   en base64) et `WINDOWS_CERTIFICATE_PASSWORD` pour signer l’installateur Windows.

## Publier

Chaque version doit avoir un numéro strictement supérieur à la précédente.

```powershell
cd app
npm version patch --no-git-tag-version
cd ..
git add app/package.json app/package-lock.json
git commit -m "Release FlightOps v1.0.1"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

Le tag doit correspondre exactement à la version indiquée dans `app/package.json`. Le workflow
Windows exécute le typage et les tests, construit l’installateur, puis publie automatiquement :

- `FlightOps-Setup-x.y.z.exe`
- `FlightOps-Setup-x.y.z.exe.blockmap`
- `latest.yml`

Les applications déjà installées lisent `latest.yml`, téléchargent uniquement la nouvelle version
et proposent de redémarrer FlightOps pour l’installer. La base de données locale n’est pas touchée.
