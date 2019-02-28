import express from 'express';
import cepController from './cep'
import configController from './config'
import sineController from './sine'
import diceController from './dice'
export default express.Router()
    .post('/', cepController.post)
    .post('/config', configController.post)
    .get('/corvinaConfig', configController.get)
    .get('/license', configController.getLicenseData)
    .post('/sine', sineController.post)
    .post('/dice', diceController.post)