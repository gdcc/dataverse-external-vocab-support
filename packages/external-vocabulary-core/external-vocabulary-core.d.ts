export interface ExternalVocabularyTerm {
  uri: string
  label: string
  vocabularyName?: string
  vocabularyUri?: string
  source?: string
  mappedFields?: Record<string, unknown>
}

export interface ExternalVocabularyConfig {
  vocabs?: Record<string, unknown>
}

export interface SearchTermsOptions {
  query: string
  vocabulary?: string
  config?: ExternalVocabularyConfig
  fetchImpl?: typeof fetch
}

export function getVocabularyNames(config?: ExternalVocabularyConfig): string[]
export function getDefaultVocabulary(config?: ExternalVocabularyConfig): string
export function getVocabularyForUri(uri: string): 'orcid' | 'ror' | undefined
export function getMappedFieldValue(term: ExternalVocabularyTerm, key: string): string | undefined
export function getManagedFieldValues(term: ExternalVocabularyTerm, managedFields?: Record<string, string>): Record<string, string>
export function getClearedManagedFieldValues(managedFields?: Record<string, string>): Record<string, string>
export function searchTerms(options: SearchTermsOptions): Promise<ExternalVocabularyTerm[]>

declare const externalVocabularyCore: {
  getVocabularyNames: typeof getVocabularyNames
  getDefaultVocabulary: typeof getDefaultVocabulary
  getVocabularyForUri: typeof getVocabularyForUri
  getMappedFieldValue: typeof getMappedFieldValue
  getManagedFieldValues: typeof getManagedFieldValues
  getClearedManagedFieldValues: typeof getClearedManagedFieldValues
  searchTerms: typeof searchTerms
}

export default externalVocabularyCore
