import type { Company } from '@shared/types/company'
import { CompanyLogo } from '@renderer/components/CompanyLogo'

interface CompanyPickerProps {
  companies: Company[]
  value: number | null
  onChange: (id: number) => void
}

export function CompanyPicker({ companies, value, onChange }: CompanyPickerProps) {
  return (
    <div className="company-picker">
      {companies.map((company) => (
        <button
          type="button"
          key={company.id}
          className={'company-picker-tile' + (value === company.id ? ' selected' : '')}
          onClick={() => onChange(company.id)}
          title={company.displayName}
        >
          <CompanyLogo logoFilename={company.logoFilename} icaoCode={company.icaoCode} width={104} height={58} />
        </button>
      ))}
    </div>
  )
}
