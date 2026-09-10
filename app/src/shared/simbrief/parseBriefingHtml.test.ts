import { describe, expect, it } from 'vitest'
import { parseBriefingHtml } from './parseBriefingHtml'

describe('parseBriefingHtml', () => {
  it('returns null for missing or invalid input', () => {
    expect(parseBriefingHtml(null)).toBeNull()
    expect(parseBriefingHtml('not json')).toBeNull()
    expect(parseBriefingHtml(JSON.stringify({ text: {} }))).toBeNull()
    expect(parseBriefingHtml(JSON.stringify({ text: { plan_html: '   ' } }))).toBeNull()
  })

  it('extracts ordered sections and replaces bookmarks with matching anchors', () => {
    const planHtml =
      '<pre><!--BKMK///Flight Information///0-->intro<!--BKMK///Dispatcher Comments///1-->hello</pre>'
    const result = parseBriefingHtml(JSON.stringify({ text: { plan_html: planHtml } }))

    expect(result).not.toBeNull()
    expect(result!.sections).toEqual([
      { id: 'briefing-sec-0', title: 'Flight Information', level: 0 },
      { id: 'briefing-sec-1', title: 'Dispatcher Comments', level: 1 }
    ])
    expect(result!.html).toBe('<pre><a id="briefing-sec-0"></a>intro<a id="briefing-sec-1"></a>hello</pre>')
  })
})
