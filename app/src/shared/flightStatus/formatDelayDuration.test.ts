import { describe, expect, it } from 'vitest'
import { formatDelayDuration } from './formatDelayDuration'

describe('formatDelayDuration', () => {
  it('formats sub-hour durations as minutes with a leading zero', () => {
    expect(formatDelayDuration(0)).toBe('00 minutes')
    expect(formatDelayDuration(7)).toBe('07 minutes')
    expect(formatDelayDuration(59)).toBe('59 minutes')
  })

  it('formats hour-plus durations as HHhMM', () => {
    expect(formatDelayDuration(60)).toBe('01h00')
    expect(formatDelayDuration(65)).toBe('01h05')
    expect(formatDelayDuration(125)).toBe('02h05')
  })

  it('treats negative durations (advance) the same as positive (delay)', () => {
    expect(formatDelayDuration(-7)).toBe('07 minutes')
    expect(formatDelayDuration(-65)).toBe('01h05')
  })

  it('rounds fractional minutes', () => {
    expect(formatDelayDuration(59.6)).toBe('01h00')
  })
})
