// Keep notify-send and its action listener in a process group that the parent
// can stop on acknowledgement, replacement or MCP shutdown.
import { NotifySend } from 'node-notifier';

process.once('message', options => {
  try {
    new NotifySend().notify(options, (error, response, metadata) => {
      if (process.connected) process.send(error
        ? { error: error.message || String(error) }
        : { metadata });
      process.disconnect();
    });
  } catch (error) {
    if (process.connected) process.send({ error: error.message });
    process.disconnect();
  }
});
