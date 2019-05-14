const UTF8 = 'utf8';
const CHAR = {
  SIGINT: 0x03,
  BACKSPACE: 0x7F,
  CR: 0x0d,
  LF: 0x0a,
  CONFIRM: 0x04
};

function passwordPrompt (prompt, callback) {
  let result = '';
  function listener (data) {
    switch (data[0]) {
      case CHAR.SIGINT:
        process.exit();
      case CHAR.BACKSPACE:
        result = result.substr(0, result.length - 1);
        break;
      case CHAR.CR:
      case CHAR.LS:
      case CHAR.CONFIRM:
        process.stdin.off('data', listener);
        process.stdin.pause();
        process.stdin.setRawMode(false);
        prompt && process.stdout.write('\n');
        callback && callback(result);
        break;
      default:
        result += data.toString(UTF8);
        break;
    }
  }

  process.stdin.setRawMode(true);
  prompt && process.stdout.write(prompt);
  process.stdin.on('data', listener);
}

module.exports = passwordPrompt;
