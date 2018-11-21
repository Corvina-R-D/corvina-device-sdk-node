import { Application } from 'express';
import deviceRouter from './api/controllers/device/router'

export default function routes(app: Application): void {
  app.use('/', deviceRouter);
  app.get('/health', function (req, res) {
    res.send('alive')
  })
};