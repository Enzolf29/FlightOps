import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CompanyPatch } from '@shared/types/company'

export function useCompanies() {
  return useQuery({
    queryKey: ['fleet', 'companies'],
    queryFn: () => window.flightops.fleet.companies.list()
  })
}

export function useUpdateCompany() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: CompanyPatch }) => window.flightops.fleet.companies.update(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet', 'companies'] })
      queryClient.invalidateQueries({ queryKey: ['fleet', 'aircraft'] })
    }
  })
}
