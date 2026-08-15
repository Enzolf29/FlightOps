interface PageStubProps {
  title: string
  description: string
}

export function PageStub({ title, description }: PageStubProps) {
  return (
    <div className="page-stub">
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}
