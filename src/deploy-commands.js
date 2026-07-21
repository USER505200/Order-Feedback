const { registerCommands } = require('./registerCommands');

registerCommands()
  .then(() => {
    console.log('Registered /complete-order successfully.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
