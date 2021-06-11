import './common/env';
import Server from './common/server';
import routes from './routes';

process.on('SIGINT', function() {
    console.log("Caught interrupt signal. Exiting...");

    process.exit();
});

const port = parseInt(process.env.PORT);
export default new Server()
  .router(routes)
  .listen(port);
