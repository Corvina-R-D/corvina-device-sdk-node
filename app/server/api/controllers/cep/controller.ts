import CEPService from '../../services/cep.service';
import { Request, Response } from 'express';

export class Controller {

  post(req: Request, res: Response): void {
    CEPService.post(req.body.name).then( (r) => {
        console.log(`\n\n=========================================\n`, req.body)
        res
          .status(200)
          .json("Ok")
      }
    );
  }
}
export default new Controller();
