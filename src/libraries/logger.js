class Logger {
  reqLog(socket) {
    console.log(socket);
    if (socket.length > 1) {
      console.log(socket[0] + ": ", socket[1]);
    } else {
      console.log(socket[0] + ": ", "no params");
    }
  }

  respLog(name, payload) {
    console.log(name, payload);
  }
}

module.exports = new Logger();
