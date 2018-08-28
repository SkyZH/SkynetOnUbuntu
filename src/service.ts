const debug = require('debug')('skynet:service');
import * as os from 'os';
import { Model, IReport } from '@skyzh/tick';
import * as _ from 'lodash';
import * as moment from 'moment';

export default class Service {
  constructor(
    private cpuModel: Model<number>,
    private memModel: Model<number>
  ) {}

  public async report(): Promise<{ [name: string]: Array<IReport<number>> }> {
    const [cpuReport, memReport] = await Promise.all([
      this.cpuModel.report(
        _.mean(
          _.map(
            os.cpus(),
            (cpu: any) =>
              (cpu.times.user + cpu.times.sys) /
              (cpu.times.user + cpu.times.sys + cpu.times.idle)
          )
        ),
        moment(Date.now())
      ),
      this.memModel.report(+(os.totalmem() - os.freemem()), moment(Date.now())),
    ]);
    return {
      cpuReport,
      memReport,
    };
  }
}
