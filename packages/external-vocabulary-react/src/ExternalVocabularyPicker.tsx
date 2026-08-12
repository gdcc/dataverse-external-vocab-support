import React, { useEffect, useId, useRef, useState } from 'react'

export interface ExternalVocabularyTerm {
  uri: string
  label: string
  vocabularyName?: string
}

export interface ExternalVocabularyVocabulary {
  id: string
  label: string
}

export interface ExternalVocabularyPickerClassNames {
  root?: string
  modes?: string
  mode?: string
  combobox?: string
  input?: string
  clearButton?: string
  toggleButton?: string
  caret?: string
  results?: string
  resultLabel?: string
  resultCaption?: string
  status?: string
}

export interface ExternalVocabularyPickerProps {
  vocabularies: ExternalVocabularyVocabulary[]
  selectedVocabulary: string
  value: string
  placeholder?: string
  required?: boolean
  invalid?: boolean
  minimumQueryLength?: number
  searchDelayMs?: number
  classNames?: ExternalVocabularyPickerClassNames
  onVocabularyChange: (vocabulary: string) => void
  onValueChange: (value: string) => void
  onSearch: (query: string, vocabulary: string) => Promise<ExternalVocabularyTerm[]>
  onSelect: (term: ExternalVocabularyTerm) => void
  onClear: () => void
}

const DEFAULT_MINIMUM_QUERY_LENGTH = 3
const DEFAULT_SEARCH_DELAY_MS = 350

export function ExternalVocabularyPicker({
  vocabularies,
  selectedVocabulary,
  value,
  placeholder = 'Select or enter...',
  required = false,
  invalid = false,
  minimumQueryLength = DEFAULT_MINIMUM_QUERY_LENGTH,
  searchDelayMs = DEFAULT_SEARCH_DELAY_MS,
  classNames,
  onVocabularyChange,
  onValueChange,
  onSearch,
  onSelect,
  onClear
}: ExternalVocabularyPickerProps) {
  const radioGroupId = useId()
  const [results, setResults] = useState<ExternalVocabularyTerm[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [status, setStatus] = useState('')
  const searchSequence = useRef(0)

  useEffect(() => {
    setResults([])
    setStatus('')
  }, [selectedVocabulary])

  const search = async (query: string) => {
    const trimmedQuery = query.trim()
    if (trimmedQuery.length < minimumQueryLength) {
      setResults([])
      setStatus('')
      return
    }

    const sequence = ++searchSequence.current
    setIsSearching(true)
    setStatus('Searching...')
    try {
      const nextResults = await onSearch(trimmedQuery, selectedVocabulary)
      if (sequence !== searchSequence.current) return
      setResults(nextResults)
      setStatus(nextResults.length === 0 ? 'No results found.' : '')
    } catch {
      if (sequence !== searchSequence.current) return
      setResults([])
      setStatus('Unable to search the external vocabulary.')
    } finally {
      if (sequence === searchSequence.current) {
        setIsSearching(false)
      }
    }
  }

  const handleValueChange = (nextValue: string) => {
    onValueChange(nextValue)
    setResults([])
    setStatus('')

    window.setTimeout(() => {
      void search(nextValue)
    }, searchDelayMs)
  }

  const handleSelect = (term: ExternalVocabularyTerm) => {
    searchSequence.current += 1
    setResults([])
    setStatus('')
    onSelect(term)
  }

  const handleClear = () => {
    searchSequence.current += 1
    setResults([])
    setStatus('')
    onClear()
  }

  const rootClassName = joinClassNames('dataverse-external-vocabulary-picker', classNames?.root)
  const hasModePicker = vocabularies.length > 1

  return (
    <div className={rootClassName}>
      {hasModePicker && (
        <div className={joinClassNames('dataverse-external-vocabulary-picker__modes', classNames?.modes)}>
          {vocabularies.map((vocabulary) => (
            <label
              className={joinClassNames('dataverse-external-vocabulary-picker__mode', classNames?.mode)}
              key={vocabulary.id}>
              <input
                checked={selectedVocabulary === vocabulary.id}
                name={radioGroupId}
                onChange={() => onVocabularyChange(vocabulary.id)}
                type="radio"
                value={vocabulary.id}
              />
              <span>{vocabulary.label}</span>
            </label>
          ))}
        </div>
      )}

      <div className={joinClassNames('dataverse-external-vocabulary-picker__combobox', classNames?.combobox)}>
        <input
          aria-autocomplete="list"
          aria-expanded={results.length > 0}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          className={joinClassNames(
            'form-control dataverse-external-vocabulary-picker__input',
            classNames?.input
          )}
          onChange={(event) => handleValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          placeholder={placeholder}
          role="combobox"
          type="text"
          value={value}
        />
        {value && (
          <button
            aria-label="Clear external vocabulary selection"
            className={joinClassNames('dataverse-external-vocabulary-picker__clear', classNames?.clearButton)}
            onClick={handleClear}
            type="button">
            x
          </button>
        )}
        <button
          aria-label={`Show ${selectedVocabulary} results`}
          className={joinClassNames('dataverse-external-vocabulary-picker__toggle', classNames?.toggleButton)}
          onClick={() => void search(value)}
          type="button">
          <span className={joinClassNames('dataverse-external-vocabulary-picker__caret', classNames?.caret)} />
        </button>
      </div>

      {results.length > 0 && (
        <div className={joinClassNames('list-group dataverse-external-vocabulary-picker__results', classNames?.results)}>
          {results.map((term) => (
            <button
              className="list-group-item list-group-item-action"
              key={term.uri}
              onClick={() => handleSelect(term)}
              type="button">
              <span className={joinClassNames('dataverse-external-vocabulary-picker__result-label', classNames?.resultLabel)}>
                {term.label}
              </span>
              {term.vocabularyName && <small className="badge bg-secondary">{term.vocabularyName}</small>}
              <small
                className={joinClassNames(
                  'text-muted dataverse-external-vocabulary-picker__result-caption',
                  classNames?.resultCaption
                )}>
                {term.uri}
              </small>
            </button>
          ))}
        </div>
      )}

      {(isSearching || status) && (
        <div className={joinClassNames('dataverse-external-vocabulary-picker__status', classNames?.status)}>
          {status}
        </div>
      )}
    </div>
  )
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ')
}
