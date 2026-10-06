import { expect, test } from 'claude-code/testing'

test('a reply with no screenshot of this session keeps the engine row and draws no image', async ($, on) => {
  on('ui.render', { component: 'AssistantMessage' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })

  const ui = await $.ui.mount({
    plugin: 'shot-preview',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'u1',
    viewport: { columns: 106, rows: 40 },
    props: { text: 'Скриншот: /T/claude-chrome-screenshots-ab/screenshot-1.jpg', isFirstOfReply: true },
  })

  expect((await ui.find({ type: 'Text', text: 'engine row' }))?.text).toBe('engine row')
  expect(await ui.find({ type: 'Image' })).toBeUndefined()
})
