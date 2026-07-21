const { registerCommands } = require('./registerCommands');

registerCommands()
  .then(() => {
    console.log('Registered slash commands successfully.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
