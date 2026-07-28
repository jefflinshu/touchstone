import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Loader2,
  ExternalLink,
  Plus,
  RefreshCw,
  Save,
  Search,
  ServerCog,
  ShieldCheck,
  Zap,
  Trash2,
  Unplug,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n.jsx'

const emptyProvider = () => ({
  id: '',
  presetId: null,
  name: '',
  baseUrl: '',
  authMode: 'auth-token',
  credential: '',
  models: [],
  hasCredential: false,
})

function draftModels(value) {
  return (Array.isArray(value) ? value : String(value || '').split(/[\r\n,]/))
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

function pemBytes(pem) {
  const base64 = String(pem || '')
    .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s+/g, '')
  const binary = atob(base64)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function encryptCredential(credential) {
  if (!credential) return null
  const response = await fetch('/api/providers/encryption-key', { cache: 'no-store' })
  const descriptor = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(descriptor.error || '无法读取本地执行器加密密钥')
  const publicKey = await crypto.subtle.importKey(
    'spki',
    pemBytes(descriptor.publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    new TextEncoder().encode(credential)
  )
  return {
    version: descriptor.version,
    algorithm: descriptor.algorithm,
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  }
}

function ProviderModelSelect({ models, catalog, onChange }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [customModel, setCustomModel] = useState('')
  const selected = draftModels(models)
  const metadata = new Map((catalog?.models || []).map((model) => [model.id, model]))
  const options = [...new Set([...selected, ...(catalog?.models || []).map((model) => model.id)])]
  const normalizedQuery = query.trim().toLowerCase()
  const visible = options.filter((id) => {
    const model = metadata.get(id)
    return !normalizedQuery || id.toLowerCase().includes(normalizedQuery) || model?.name?.toLowerCase().includes(normalizedQuery)
  })

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((model) => model !== id) : [...selected, id])
  }

  function addCustom() {
    const id = customModel.trim()
    if (!id) return
    onChange([...new Set([...selected, id])])
    setCustomModel('')
  }

  return (
    <div className="space-y-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-10 w-full items-center gap-2 rounded-md border border-white/15 bg-white/[0.03] px-3 text-left outline-none transition-colors hover:border-sky-300/45"
          >
            <span className="min-w-0 flex-1 text-[12px] font-medium text-white/80">
              {selected.length ? t('provider.modelsSelected', { count: selected.length }) : t('provider.modelsChoose')}
            </span>
            <ChevronDown className="h-4 w-4 text-white/40" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[min(520px,calc(100vw-48px))] p-2"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder={t('provider.modelsSearch')}
              className="h-9 w-full rounded-md border border-white/12 bg-white/[0.04] pr-3 pl-8 text-[12px] text-white outline-none placeholder:text-white/30 focus:border-sky-300/50"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {visible.map((id) => {
              const model = metadata.get(id)
              const checked = selected.includes(id)
              return (
                <DropdownMenuItem
                  key={id}
                  onSelect={(event) => {
                    event.preventDefault()
                    toggle(id)
                  }}
                  className="py-2"
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      checked ? 'border-sky-300 bg-sky-300 text-black' : 'border-white/25'
                    )}
                  >
                    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-white/85">{model?.name || id}</span>
                    {model?.name && model.name !== id && (
                      <span className="block truncate font-mono text-[9px] text-white/40">{id}</span>
                    )}
                  </span>
                </DropdownMenuItem>
              )
            })}
            {visible.length === 0 && (
              <p className="px-3 py-5 text-center text-[11px] text-white/45">{t('provider.noModelMatch')}</p>
            )}
          </div>
          <div className="mt-2 flex gap-2 border-t border-white/10 pt-2">
            <input
              value={customModel}
              onChange={(event) => setCustomModel(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addCustom()
                }
              }}
              placeholder={t('provider.modelsCustomPlaceholder')}
              className="h-8 min-w-0 flex-1 rounded border border-white/12 bg-white/[0.03] px-2.5 font-mono text-[10px] text-white outline-none placeholder:text-white/30 focus:border-sky-300/50"
              spellCheck={false}
            />
            <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={!customModel.trim()}>
              <Plus className="h-3.5 w-3.5" />
              {t('provider.modelsAdd')}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {selected.length > 0 && (
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-white/10 bg-white/[0.02] p-2">
          {selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              title={t('provider.modelsRemove', { model: id })}
              className="flex max-w-full items-center gap-1 rounded-full border border-sky-300/25 bg-sky-300/8 px-2 py-1 font-mono text-[9px] text-sky-200 hover:border-red-300/35 hover:text-red-300"
            >
              <span className="truncate">{metadata.get(id)?.name || id}</span>
              <X className="h-2.5 w-2.5 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProviderManager({ providers, onChange, user, onLogin, runner, className }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(emptyProvider)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const [presets, setPresets] = useState([])
  const [catalog, setCatalog] = useState(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/provider-presets')
      .then((response) => response.json())
      .then((data) => setPresets(data.presets || []))
      .catch(() => setPresets([]))
    setDraft((current) => {
      if (current.id && providers.some((provider) => provider.id === current.id)) return current
      return providers[0] ? { ...providers[0], credential: '' } : emptyProvider()
    })
  }, [open, providers])

  useEffect(() => {
    if (!open || !draft.catalogProviderId) {
      setCatalog(null)
      return
    }
    let cancelled = false
    fetch(`/api/model-catalog?provider=${encodeURIComponent(draft.catalogProviderId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setCatalog(data.catalog || null)
      })
      .catch(() => {
        if (!cancelled) setCatalog(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, draft.catalogProviderId])

  function edit(provider) {
    setDraft({ ...provider, credential: '' })
    setNotice(null)
  }

  function usePreset(preset) {
    setDraft({
      ...emptyProvider(),
      presetId: preset.id,
      name: preset.name,
      baseUrl: preset.baseUrl,
      authMode: preset.authMode,
      docsUrl: preset.docsUrl,
      catalogProviderId: preset.providerId,
    })
    setNotice(null)
  }

  async function request(url, options) {
    const response = await fetch(url, options)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'failed')
    if (data.providers) onChange(data.providers)
    return data
  }

  async function save() {
    if (!user) {
      onLogin?.()
      return null
    }
    setBusy('save')
    setNotice(null)
    try {
      const credentialEnvelope = await encryptCredential(draft.credential)
      const { credential: _credential, ...providerDraft } = draft
      const data = await request('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...providerDraft,
          credentialEnvelope,
          models: draftModels(draft.models),
        }),
      })
      setDraft({ ...data.provider, credential: '' })
      setNotice({ ok: true, text: t('provider.saved') })
      return data.provider
    } catch (error) {
      setNotice({ ok: false, text: error.message })
      return null
    } finally {
      setBusy('')
    }
  }

  async function discover() {
    const provider = await save()
    if (!provider) return
    setBusy('discover')
    setNotice(null)
    try {
      const data = await request(`/api/providers/${provider.id}/discover`, { method: 'POST' })
      setDraft({ ...data.provider, credential: '' })
      setNotice({ ok: true, text: t('provider.discovered', { count: data.provider.models.length }) })
    } catch (error) {
      setNotice({ ok: false, text: error.message })
    } finally {
      setBusy('')
    }
  }

  async function testProvider() {
    const provider = await save()
    if (!provider) return
    const model = provider.models[0]
    setBusy('test')
    setNotice(null)
    try {
      const data = await request(`/api/providers/${provider.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      })
      setNotice({ ok: true, text: `${data.message} · ${data.model}` })
    } catch (error) {
      setNotice({ ok: false, text: error.message })
    } finally {
      setBusy('')
    }
  }

  async function remove() {
    if (!draft.id || !confirm(t('provider.deleteConfirm', { name: draft.name }))) return
    setBusy('delete')
    setNotice(null)
    try {
      const data = await request(`/api/providers/${draft.id}`, { method: 'DELETE' })
      setDraft(data.providers[0] ? { ...data.providers[0], credential: '' } : emptyProvider())
    } catch (error) {
      setNotice({ ok: false, text: error.message })
    } finally {
      setBusy('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-8 gap-1.5 font-mono text-[10px] tracking-[0.12em] uppercase',
            className
          )}
          title={!runner?.canExecute ? t('runner.errorNotPaired') : undefined}
        >
          <ServerCog className="h-3.5 w-3.5 text-sky-300" />
          {t('provider.manage')}
          {providers.length > 0 && (
            <span className="rounded-full bg-sky-300/10 px-1.5 text-sky-200">{providers.length}</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="provider-manager flex h-[min(780px,94vh)] w-[min(1080px,96vw)] flex-col overflow-hidden rounded-xl">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-5">
          <ServerCog className="h-4 w-4 text-sky-300" />
          <div>
            <DialogTitle className="text-[15px] font-semibold text-white/90">{t('provider.title')}</DialogTitle>
            <p className="mt-0.5 text-[11px] text-white/55">{t('provider.subtitle')}</p>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" className="ml-auto">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </header>

        <div className="grid min-h-0 flex-1 md:grid-cols-[280px_1fr]">
          <aside className="min-h-0 overflow-auto border-b border-white/10 p-3 md:border-r md:border-b-0">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => usePreset(preset)}
                className={cn(
                  'mb-2 w-full rounded-md border px-3 py-3 text-left transition-colors',
                  draft.presetId === preset.id && !draft.id
                    ? 'border-emerald-300/40 bg-emerald-300/[0.06]'
                    : 'border-emerald-300/15 bg-emerald-300/[0.025] hover:border-emerald-300/35'
                )}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-emerald-100">
                  <Zap className="h-3.5 w-3.5" />
                  {preset.name}
                </span>
                <span className="mt-1.5 block text-[10px] leading-5 text-white/55">
                  {t('provider.zenmuxQuick')}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => edit(emptyProvider())}
              className="mb-2 flex w-full items-center gap-2 rounded-md border border-dashed border-white/15 px-3 py-2 text-left text-xs text-white/55 transition-colors hover:border-sky-300/40 hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('provider.addCustom')}
            </button>
            <div className="space-y-1.5">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => edit(provider)}
                  className={cn(
                    'w-full rounded-md border px-3 py-2.5 text-left transition-colors',
                    draft.id === provider.id
                      ? 'border-sky-300/35 bg-sky-300/[0.06]'
                      : 'border-transparent hover:border-white/10 hover:bg-white/[0.025]'
                  )}
                >
                  <span className="block truncate text-xs font-medium text-white/80">{provider.name}</span>
                  {provider.presetId && (
                    <span className="mt-1 inline-flex rounded-full bg-emerald-300/10 px-1.5 font-mono text-[8px] text-emerald-200/70">
                      PRESET
                    </span>
                  )}
                  <span className="mt-1 block truncate font-mono text-[9px] text-white/30">{provider.baseUrl}</span>
                  <span className="mt-1.5 flex items-center gap-2 font-mono text-[8px] text-white/35 uppercase">
                    <span>{provider.models.length} models</span>
                    {provider.hasCredential && <span className="text-emerald-300/70">token saved</span>}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-auto p-5">
            {!runner?.canExecute && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/[0.045] px-3 py-2.5">
                <Unplug className="h-4 w-4 shrink-0 text-amber-300" />
                <p className="min-w-0 flex-1 text-[12px] leading-5 text-amber-200">
                  {t('provider.runnerRequired', { label: runner?.label || 'Owner Mac' })}
                </p>
                {!user && (
                  <Button type="button" variant="outline" size="sm" onClick={onLogin}>
                    {t('nav.signIn')}
                  </Button>
                )}
              </div>
            )}
            {draft.presetId && (
              <div className="mb-4 flex flex-wrap items-start gap-3 rounded-md border border-emerald-300/18 bg-emerald-300/[0.035] px-3 py-2.5">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-emerald-100">{t('provider.zenmuxReady')}</p>
                  <p className="mt-1 text-[11px] leading-5 text-white/55">{t('provider.zenmuxHelp')}</p>
                </div>
                {draft.docsUrl && (
                  <a
                    href={draft.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 font-mono text-[9px] text-emerald-200/65 hover:text-emerald-100"
                  >
                    {t('provider.guide')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase">{t('provider.name')}</span>
                <Input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Jeff Model Gateway"
                />
              </label>
              <label className="space-y-1.5">
                <span className="font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase">{t('provider.auth')}</span>
                <span className="grid h-9 grid-cols-2 overflow-hidden rounded-md border border-white/12">
                  {[
                    ['auth-token', 'Bearer token'],
                    ['api-key', 'x-api-key'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={Boolean(draft.presetId)}
                      onClick={() => setDraft((current) => ({ ...current, authMode: value }))}
                      className={cn(
                        'font-mono text-[10px] transition-colors',
                        draft.authMode === value ? 'bg-sky-300 text-black' : 'text-white/40 hover:text-white'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </span>
              </label>
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase">{t('provider.baseUrl')}</span>
              <Input
                value={draft.baseUrl}
                disabled={Boolean(draft.presetId)}
                onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                placeholder="https://gateway.example.com"
                spellCheck={false}
              />
              <span className="block text-[11px] leading-5 text-white/50">{t('provider.baseUrlHelp')}</span>
            </label>

            <label className="mt-4 block space-y-1.5">
              <span className="font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase">{t('provider.token')}</span>
              <Input
                type="password"
                autoComplete="off"
                value={draft.credential}
                onChange={(event) => setDraft((current) => ({ ...current, credential: event.target.value }))}
                placeholder={draft.hasCredential ? t('provider.tokenStored') : 'sk-...'}
              />
              <span className="flex items-center gap-1.5 text-[11px] leading-5 text-white/50">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                {t('provider.tokenHelp')}
              </span>
            </label>

            <label className="mt-4 block space-y-1.5">
              <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-white/60 uppercase">
                {t('provider.models')}
                <span className="text-white/20">{t('provider.modelsCount', { count: draftModels(draft.models).length })}</span>
              </span>
              <ProviderModelSelect
                models={draft.models}
                catalog={catalog}
                onChange={(models) => setDraft((current) => ({ ...current, models }))}
              />
              <span className="block text-[11px] leading-5 text-white/50">{t('provider.modelsHelp')}</span>
              {draft.catalogProviderId && (
                <a
                  href={`https://models.dev/providers/${draft.catalogProviderId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-[9px] text-sky-200/55 hover:text-sky-100"
                >
                  {t('provider.catalogSource')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </label>

            {notice && (
              <div
                className={cn(
                  'mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] leading-5',
                  notice.ok
                    ? 'border-emerald-300/20 bg-emerald-300/[0.04] text-emerald-100/75'
                    : 'border-red-300/20 bg-red-300/[0.04] text-red-200/80'
                )}
              >
                {notice.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
                {notice.text}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
              <Button type="button" onClick={save} disabled={Boolean(busy) || !runner?.canExecute}>
                {busy === 'save' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t('provider.save')}
              </Button>
              <Button type="button" variant="outline" onClick={discover} disabled={Boolean(busy) || !runner?.canExecute}>
                {busy === 'discover' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {draft.presetId ? t('provider.saveSync') : t('provider.sync')}
              </Button>
              <Button type="button" variant="outline" onClick={testProvider} disabled={Boolean(busy) || !runner?.canExecute}>
                {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                {t('provider.test')}
              </Button>
              {draft.id && (
                <Button type="button" variant="ghost" className="ml-auto text-red-300/60 hover:text-red-300" onClick={remove} disabled={Boolean(busy)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('provider.delete')}
                </Button>
              )}
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-md border border-emerald-300/15 bg-emerald-300/[0.035] px-3 py-2.5 text-[11px] leading-5 text-white/55">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <span>{t('provider.security')}</span>
            </p>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
