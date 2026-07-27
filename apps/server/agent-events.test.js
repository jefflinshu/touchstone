import assert from 'node:assert/strict'
import test from 'node:test'
import { createAgentEventParser } from './agent-events.js'

const parse = (agentId, values) => {
  const events = []
  const parser = createAgentEventParser({ agentId, emit: (event) => events.push(event) })
  parser.push('stdout', `${values.map((value) => JSON.stringify(value)).join('\n')}\n`)
  parser.end()
  return events
}

test('normalizes Codex JSONL tool updates and assistant markdown', () => {
  const events = parse('codex', [
    { type: 'turn.started' },
    { type: 'item.started', item: { id: 'tool-1', type: 'command_execution', command: 'npm test', status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'tool-1', type: 'command_execution', command: 'npm test', aggregated_output: 'ok', status: 'completed' } },
    { type: 'item.completed', item: { id: 'answer-1', type: 'agent_message', text: '## Done\nAll good' } },
  ])

  assert.equal(events[1].kind, 'tool')
  assert.equal(events[1].status, 'running')
  assert.equal(events[2].id, events[1].id)
  assert.equal(events[2].status, 'completed')
  assert.equal(events[3].kind, 'assistant')
  assert.match(events[3].content, /## Done/)
})

test('normalizes Codex app-server plan and input request messages', () => {
  const events = parse('codex', [
    {
      method: 'turn/plan/updated',
      params: {
        turnId: 'turn-1',
        explanation: 'Implementation plan',
        plan: [
          { step: 'Inspect', status: 'completed' },
          { step: 'Build', status: 'inProgress' },
        ],
      },
    },
    {
      id: 42,
      method: 'item/tool/requestUserInput',
      params: {
        itemId: 'question-1',
        questions: [{ question: 'Choose a format', options: [{ label: 'SVG' }] }],
      },
    },
  ])

  assert.equal(events[0].kind, 'progress')
  assert.equal(events[0].items[0].status, 'completed')
  assert.equal(events[0].items[1].status, 'running')
  assert.equal(events[1].kind, 'question')
  assert.equal(events[1].questions[0].options[0].label, 'SVG')
})

test('normalizes Claude questions and task progress', () => {
  const events = parse('claude', [
    {
      type: 'assistant',
      message: {
        id: 'message-1',
        content: [
          {
            type: 'tool_use',
            id: 'question-1',
            name: 'AskUserQuestion',
            input: { questions: [{ question: 'Pick one', options: [{ label: 'A' }] }] },
          },
          {
            type: 'tool_use',
            id: 'todo-1',
            name: 'TodoWrite',
            input: { todos: [{ content: 'Build UI', status: 'in_progress' }] },
          },
        ],
      },
    },
  ])

  assert.equal(events[0].kind, 'question')
  assert.equal(events[0].status, 'pending')
  assert.equal(events[0].questions[0].options[0].label, 'A')
  assert.equal(events[1].kind, 'progress')
  assert.equal(events[1].items[0].status, 'running')
})

test('normalizes Gemini stream-json messages and tools', () => {
  const events = parse('gemini', [
    { type: 'init', session_id: 'session-1', model: 'gemini-3.1-pro' },
    { type: 'message', id: 'message-1', role: 'assistant', content: 'Working', partial: true },
    { type: 'tool_use', tool_id: 'tool-1', tool_name: 'write_file', parameters: { path: 'index.html' } },
    { type: 'tool_result', tool_id: 'tool-1', output: 'ok' },
    { type: 'result', stats: { input_tokens: 10, output_tokens: 20 } },
  ])

  assert.equal(events[0].kind, 'status')
  assert.equal(events[1].kind, 'assistant')
  assert.equal(events[2].kind, 'tool')
  assert.equal(events[2].status, 'running')
  assert.equal(events[3].id, events[2].id)
  assert.equal(events[3].status, 'completed')
  assert.equal(events[4].status, 'completed')
})
