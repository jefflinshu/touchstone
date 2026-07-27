const MAX_TEXT = 60_000

const clip = (value, max = MAX_TEXT) => {
  const text = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2)
  return text.length > max ? `${text.slice(0, max)}\n…` : text
}

const statusOf = (value) => {
  if (value === 'completed' || value === 'success' || value === 'done') return 'completed'
  if (value === 'failed' || value === 'error') return 'failed'
  if (value === 'pending' || value === 'queued') return 'pending'
  return 'running'
}

const todoItems = (items = []) =>
  items
    .map((item, index) => ({
      id: String(item.id || index),
      content: String(item.content || item.text || item.title || item.description || '').trim(),
      status: statusOf(item.status),
    }))
    .filter((item) => item.content)

const toolTitle = (name, input = {}) => {
  const normalized = String(name || 'Tool').replaceAll('_', ' ')
  if (/bash|shell|command|exec/i.test(normalized) && input.command) return clip(input.command, 180)
  if (/read/i.test(normalized) && (input.file_path || input.path)) return `Read ${input.file_path || input.path}`
  if (/write|edit|patch/i.test(normalized) && (input.file_path || input.path)) return `Edit ${input.file_path || input.path}`
  return normalized
}

function mapCodexItem(item = {}, phase) {
  const id = String(item.id || `codex-${item.type || 'item'}`)
  const status = phase === 'completed' ? statusOf(item.status === 'failed' ? 'failed' : 'completed') : statusOf(item.status)

  if (item.type === 'agent_message') {
    return { id, kind: 'assistant', status, content: clip(item.text || item.content) }
  }
  if (item.type === 'reasoning') {
    return { id, kind: 'status', status, title: 'Thinking', content: clip(item.text || item.summary || item.content) }
  }
  if (item.type === 'todo_list') {
    return { id, kind: 'progress', status, title: 'Task progress', items: todoItems(item.items || item.todos) }
  }

  const name = item.type === 'command_execution' ? 'Shell' : item.tool || item.name || item.type || 'Tool'
  const input =
    item.input ||
    (item.command ? { command: item.command } : null) ||
    (item.changes ? { changes: item.changes } : null) ||
    (item.query ? { query: item.query } : null)
  return {
    id,
    kind: 'tool',
    status,
    title: toolTitle(name, input || {}),
    tool: name,
    input,
    output: clip(item.aggregated_output || item.output || item.result || item.error),
  }
}

export function createAgentEventParser({ agentId, emit, onResult }) {
  const buffers = { stdout: '', stderr: '' }
  let raw = ''
  let assistantIndex = 0
  let liveAssistantId = ''
  let liveAssistantText = ''
  const toolInputs = new Map()

  const send = (event) =>
    emit({
      ...event,
      id: String(event.id || `${agentId}-${Date.now()}`),
      timestamp: new Date().toISOString(),
    })

  const sendRaw = (text, channel) => {
    if (!text.trim()) return
    raw = clip(`${raw}${text}`)
    send({
      id: `${agentId}-raw`,
      kind: channel === 'stderr' ? 'status' : 'raw',
      status: channel === 'stderr' ? 'running' : 'completed',
      title: channel === 'stderr' ? 'Agent output' : 'Raw output',
      content: raw,
    })
  }

  const parseClaudeContent = (message = {}) => {
    const messageId = message.id || `claude-message-${assistantIndex++}`
    for (const [index, part] of (message.content || []).entries()) {
      if (part.type === 'text' && part.text) {
        const id = liveAssistantId === messageId && part.text === liveAssistantText ? `${messageId}-text` : `${messageId}-text-${index}`
        send({ id, kind: 'assistant', status: 'completed', content: clip(part.text) })
        continue
      }
      if (part.type !== 'tool_use') continue
      const name = part.name || 'Tool'
      if (/askuserquestion|question/i.test(name)) {
        send({
          id: part.id,
          kind: 'question',
          status: 'pending',
          title: part.input?.header || 'Agent needs input',
          questions: part.input?.questions || [{ question: part.input?.question || 'How should the agent continue?', options: part.input?.options || [] }],
        })
      } else if (/todowrite|update_plan|taskprogress/i.test(name)) {
        send({
          id: part.id,
          kind: 'progress',
          status: 'running',
          title: 'Task progress',
          items: todoItems(part.input?.todos || part.input?.items || part.input?.plan),
        })
      } else {
        send({
          id: part.id,
          kind: 'tool',
          status: 'running',
          title: toolTitle(name, part.input),
          tool: name,
          input: part.input,
        })
      }
    }
  }

  const parseClaude = (event) => {
    if (event.type === 'assistant') {
      parseClaudeContent(event.message)
      return true
    }
    if (event.type === 'user') {
      for (const part of event.message?.content || []) {
        if (part.type !== 'tool_result') continue
        send({
          id: part.tool_use_id,
          kind: 'tool',
          status: part.is_error ? 'failed' : 'completed',
          output: clip(part.content),
        })
      }
      return true
    }
    if (event.type === 'stream_event') {
      const stream = event.event || {}
      if (stream.type === 'message_start') {
        liveAssistantId = stream.message?.id || `claude-live-${assistantIndex++}`
        liveAssistantText = ''
      } else if (stream.type === 'content_block_start') {
        const part = stream.content_block || {}
        if (part.type === 'tool_use') {
          toolInputs.set(part.id, { name: part.name, json: '' })
          send({ id: part.id, kind: 'tool', status: 'running', title: toolTitle(part.name), tool: part.name })
        }
      } else if (stream.type === 'content_block_delta') {
        if (stream.delta?.type === 'text_delta') {
          liveAssistantText += stream.delta.text || ''
          send({ id: `${liveAssistantId}-text`, kind: 'assistant', status: 'running', content: clip(liveAssistantText) })
        }
        if (stream.delta?.type === 'input_json_delta') {
          const current = [...toolInputs.entries()].at(-1)
          if (current) {
            current[1].json += stream.delta.partial_json || ''
            let input = current[1].json
            try {
              input = JSON.parse(input)
            } catch {}
            send({
              id: current[0],
              kind: 'tool',
              status: 'running',
              title: toolTitle(current[1].name, typeof input === 'object' ? input : {}),
              tool: current[1].name,
              input,
            })
          }
        }
      } else if (stream.type === 'message_stop' && liveAssistantId) {
        send({ id: `${liveAssistantId}-text`, kind: 'assistant', status: 'completed', content: clip(liveAssistantText) })
      }
      return true
    }
    if (event.type === 'result') {
      send({
        id: 'run-result',
        kind: 'status',
        status: event.is_error ? 'failed' : 'completed',
        title: event.is_error ? 'Run failed' : 'Run completed',
        content: clip(event.error || ''),
        metrics: {
          costUsd: event.total_cost_usd,
          durationMs: event.duration_ms,
          turns: event.num_turns,
        },
      })
      onResult?.(event)
      return true
    }
    return false
  }

  const parseCodex = (event) => {
    if (/^item\.(started|updated|completed)$/.test(event.type)) {
      send(mapCodexItem(event.item, event.type.split('.')[1]))
      return true
    }
    if (event.type === 'turn.started') {
      send({ id: 'turn-status', kind: 'status', status: 'running', title: 'Working' })
      return true
    }
    if (event.type === 'turn.completed') {
      send({ id: 'turn-status', kind: 'status', status: 'completed', title: 'Completed', metrics: event.usage })
      return true
    }
    if (event.type === 'turn.failed' || event.type === 'error') {
      send({ id: 'turn-status', kind: 'status', status: 'failed', title: 'Run failed', content: clip(event.error || event.message) })
      return true
    }
    return event.type === 'thread.started'
  }

  const parseGemini = (event) => {
    if (event.type === 'init') {
      send({
        id: 'gemini-session',
        kind: 'status',
        status: 'running',
        title: event.model ? `Using ${event.model}` : 'Gemini session started',
        content: event.session_id || event.sessionId || '',
      })
      return true
    }
    if (event.type === 'message') {
      const role = event.role || event.message?.role
      const content = event.content || event.text || event.delta || event.message?.content
      if (role === 'assistant' && content) {
        send({
          id: event.id || 'gemini-response',
          kind: 'assistant',
          status: event.partial === false || event.done ? 'completed' : 'running',
          content: clip(content),
        })
        return true
      }
      return role === 'user'
    }
    if (event.type === 'tool_use') {
      const tool = event.tool_name || event.name || event.tool || 'Tool'
      send({
        id: event.tool_id || event.id || `gemini-tool-${tool}`,
        kind: 'tool',
        status: 'running',
        title: toolTitle(tool, event.parameters || event.args || event.input || {}),
        tool,
        input: event.parameters || event.args || event.input,
      })
      return true
    }
    if (event.type === 'tool_result') {
      send({
        id: event.tool_id || event.id || 'gemini-tool',
        kind: 'tool',
        status: event.error ? 'failed' : 'completed',
        output: clip(event.output || event.result || event.content || event.error),
      })
      return true
    }
    if (event.type === 'error') {
      send({
        id: event.id || 'gemini-error',
        kind: 'status',
        status: event.fatal === false ? 'running' : 'failed',
        title: event.fatal === false ? 'Gemini warning' : 'Gemini failed',
        content: clip(event.error || event.message),
      })
      return true
    }
    if (event.type === 'result') {
      send({
        id: 'run-result',
        kind: 'status',
        status: event.error ? 'failed' : 'completed',
        title: event.error ? 'Run failed' : 'Run completed',
        content: clip(event.error || event.response),
        metrics: event.stats || event.usage,
      })
      return true
    }
    return false
  }

  const parseGeneric = (event) => {
    if (agentId === 'claude' && parseClaude(event)) return true
    if (agentId === 'codex' && parseCodex(event)) return true
    if (agentId === 'gemini' && parseGemini(event)) return true
    const content = event.response || event.text || event.content
    if (typeof content === 'string' && content) {
      send({ id: `${agentId}-response`, kind: 'assistant', status: 'completed', content: clip(content) })
      return true
    }
    return false
  }

  const consumeLine = (line, channel) => {
    if (!line.trim()) return
    try {
      if (parseGeneric(JSON.parse(line))) return
    } catch {}
    sendRaw(`${line}\n`, channel)
  }

  return {
    push(channel, chunk) {
      buffers[channel] += chunk
      const lines = buffers[channel].split(/\r?\n/)
      buffers[channel] = lines.pop() || ''
      for (const line of lines) consumeLine(line, channel)
    },
    end() {
      for (const channel of ['stdout', 'stderr']) {
        if (buffers[channel]) consumeLine(buffers[channel], channel)
        buffers[channel] = ''
      }
    },
    status(status, title, content = '') {
      send({ id: 'run-status', kind: 'status', status, title, content })
    },
  }
}
