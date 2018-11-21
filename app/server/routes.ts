import { Application } from 'express';
import cepRouter from './api/controllers/cep/router'
export default function routes(app: Application): void {
  app.use('/', cepRouter);
};