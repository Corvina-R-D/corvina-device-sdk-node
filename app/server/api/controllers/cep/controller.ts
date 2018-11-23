import CEPService,  {DataPoint} from '../../services/cep.service';
import { Request, Response } from 'express';

export class Controller {

  post(req: Request, res: Response): void {
    try {
    /*
    {
      "series":[
         {
            "name":"JMobileTags",
            "tags":{
               "assetid":"PLC1",
               "path":"49390/1/7bd1f264a58c44c8914de390f5ff0f33/d71e263379134c5ea3a3c094a79054b2/PLC1/"
            },
            "columns":[
               "time",
               "Tag1Value"
            ],
            "values":[
               [
                  "2018-11-21T20:54:50.812Z",
                  397
               ]
            ]
         }
      ]
   }
   */
    let dataPoints = new Array<DataPoint>();
    for (let s of req.body.series) {
      for (let v of s.values) {
        const dp: DataPoint = {
          tagName: s.columns[1],
          value: v[1],
          timestamp: v[0]
        };
        dataPoints.push(dp)
      }
    }
    CEPService.post(dataPoints).then( (r) => {
        res
          .status(200)
          .json("Ok")
      }
    );
    } catch(err) {
       res.status(500).json(err)
    }
  }
}
export default new Controller();
