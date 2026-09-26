import { describe, expect, it } from 'vitest'
import { dayPeriodFromTimeOfDay, pickAnnouncementFile } from './pickAnnouncementFile'

const files = [
  { id: 1, variant: 'any' as const },
  { id: 2, variant: 'day' as const },
  { id: 3, variant: 'night' as const },
  { id: 4, variant: 'night' as const }
]

describe('dayPeriodFromTimeOfDay', () => {
  it('counts dawn as day and dusk as night', () => {
    expect(dayPeriodFromTimeOfDay(0)).toBe('day')
    expect(dayPeriodFromTimeOfDay(1)).toBe('day')
    expect(dayPeriodFromTimeOfDay(2)).toBe('night')
    expect(dayPeriodFromTimeOfDay(3)).toBe('night')
    expect(dayPeriodFromTimeOfDay(undefined)).toBeNull()
  })
})

describe('pickAnnouncementFile', () => {
  it('returns null when there is no file', () => {
    expect(pickAnnouncementFile([], 'day')).toBeNull()
  })

  it('only picks files matching the period, plus "any" files', () => {
    const picked = new Set<number>()
    for (let step = 0; step < 20; step += 1) picked.add(pickAnnouncementFile(files, 'day', null, () => step / 20)!.id)
    expect([...picked].sort()).toEqual([1, 2])
    picked.clear()
    for (let step = 0; step < 20; step += 1) picked.add(pickAnnouncementFile(files, 'night', null, () => step / 20)!.id)
    expect([...picked].sort()).toEqual([1, 3, 4])
  })

  it('plays nothing when every file is reserved to another period', () => {
    const dayOnly = [{ id: 7, variant: 'day' as const }, { id: 8, variant: 'day' as const }]
    expect(pickAnnouncementFile(dayOnly, 'night', null, () => 0.9)).toBeNull()
    const nightOnly = [{ id: 9, variant: 'night' as const }]
    expect(pickAnnouncementFile(nightOnly, 'day')).toBeNull()
    expect(pickAnnouncementFile(nightOnly, 'night')!.id).toBe(9)
  })

  it('uses every file when the period is unknown', () => {
    expect(pickAnnouncementFile(files, null, null, () => 0.99)!.id).toBe(4)
  })

  it('avoids replaying the previous file when another one is available', () => {
    const pair = [{ id: 1, variant: 'any' as const }, { id: 2, variant: 'any' as const }]
    for (let step = 0; step < 10; step += 1) expect(pickAnnouncementFile(pair, 'day', 1, () => step / 10)!.id).toBe(2)
  })

  it('still plays the only file even if it was the previous one', () => {
    expect(pickAnnouncementFile([{ id: 1, variant: 'any' as const }], 'day', 1)!.id).toBe(1)
  })
})
