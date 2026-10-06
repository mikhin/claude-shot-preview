import { expect, test } from 'claude-code/testing'

import { imagePaths } from '../hooks/paths'

test('a path in backticks is taken whole, spaces and parentheses included', () => {
  expect(imagePaths('- `~/Documents/Сканы/passport (1).jpg`: внутренний паспорт')).toEqual(['~/Documents/Сканы/passport (1).jpg'])
})

test('home-relative, absolute and Windows paths are found bare in prose', () => {
  expect(imagePaths('~/Documents/a.jpeg и /var/T/shot-0.jpg, ещё C:\\Users\\me\\b.png.')).toEqual([
    '~/Documents/a.jpeg',
    '/var/T/shot-0.jpg',
    'C:\\Users\\me\\b.png',
  ])
})

test('code that only mentions an image extension is no path', () => {
  expect(imagePaths('`sips -s format png` writes `<name>.png`, see `foo.jpg`')).toEqual([])
})

test('the same path named twice is taken once', () => {
  expect(imagePaths('`/a/b.png` and /a/b.png')).toEqual(['/a/b.png'])
})
