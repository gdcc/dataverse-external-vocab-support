import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { ExternalVocabularyPicker, ExternalVocabularyPickerProps } from './ExternalVocabularyPicker'

const roots = new WeakMap<Element, Root>()

export function mount(element: Element, props: ExternalVocabularyPickerProps) {
  let root = roots.get(element)
  if (!root) {
    root = createRoot(element)
    roots.set(element, root)
  }

  const render = (nextProps: ExternalVocabularyPickerProps) => {
    root?.render(<ExternalVocabularyPicker {...nextProps} />)
  }

  render(props)
  return {
    render,
    unmount: () => {
      root?.unmount()
      roots.delete(element)
    }
  }
}
