import express from 'express';
import cepController from './cep'
import sineController from './sine'
import diceController from './dice'
export default express.Router()
    .post('/', cepController.post)
    .post('/sine', sineController.post)
    .post('/dice', diceController.post)