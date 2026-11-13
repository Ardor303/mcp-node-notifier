import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export function createServer(manager) {
  const server = new Server({ name: 'mcp-node-notifier', version: '0.1.0' }, {
    capabilities: { tools: {} },
    instructions: 'Send local desktop notifications when requested. Use list_notification_profiles to discover configured profiles and their intended purpose. Choose a profile by name, or use kind for a built-in profile. A profile determines its kind. Use waiting just before asking for user input; the local timer handles repeats. Use a stable task_id unique to this chat/task. Success/error for that task stops its old waiting reminder. Info does not stop it. Acknowledgement only silences a reminder: it is not an answer, approval, or permission. Reminders last only while this MCP process is running. Do not call tools repeatedly to implement a timer.'
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [
    {
      name: 'notify',
      description: 'Show a local notification using a built-in kind or a configured profile from list_notification_profiles. The profile supplies its kind, title, icon and audio settings. Waiting can repeat until acknowledged. Returns promptly; later delivery errors appear in list_notifications.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {
        kind: { type: 'string', enum: ['success', 'error', 'waiting', 'info'], description: 'Select a built-in profile. Optional if profile is given; if both are given they must agree.' },
        profile: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{0,63}$', description: 'Configured profile name, e.g. customNotify. Discover names and their kinds with list_notification_profiles. Its kind controls waiting/completion behavior.' },
        message: { type: 'string', minLength: 1, maxLength: 2000 },
        title: { type: 'string', minLength: 1, maxLength: 160 },
        task_id: { type: 'string', minLength: 1, maxLength: 200, description: 'Stable unique chat/task ID; required for waiting. Use the same ID on completion.' },
        sound: { type: 'boolean', description: 'Set false for a silent notification.' },
        repeat_minutes: { type: 'number', minimum: 0, maximum: 1440, description: 'Only waiting: 0 disables repeats; otherwise at least 0.1 minutes. Default comes from config (5 minutes).' },
        repeat_mode: { type: 'string', enum: ['both', 'sound', 'notification'] }
      }, required: ['message'], anyOf: [{ required: ['kind'] }, { required: ['profile'] }] },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
    },
    {
      name: 'acknowledge_notification', description: 'Stop repetitions and audio for one notification. Does not answer a question or grant permission.',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    {
      name: 'list_notifications', description: 'Inspect current reminders, acknowledgements and asynchronous delivery/audio errors for this MCP connection.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    {
      name: 'list_notification_profiles', description: 'List available built-in and custom notification profiles with their names, kinds, titles and descriptions. Reads current configuration; use the returned name in notify.profile.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, openWorldHint: false }
    }
  ] }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const args = request.params.arguments || {};
      let result;
      switch (request.params.name) {
        case 'notify': result = await manager.notify(args); break;
        case 'acknowledge_notification': result = manager.acknowledge(args.id); break;
        case 'list_notifications': result = { notifications: manager.list() }; break;
        case 'list_notification_profiles': result = { profiles: await manager.listProfiles() }; break;
        default: throw new Error(`Unknown tool: ${request.params.name}`);
      }
      return { content: [{ type: 'text', text: JSON.stringify(result) }], isError: Boolean(result.last_error && result.deliveries === 0) };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  });
  return server;
}
