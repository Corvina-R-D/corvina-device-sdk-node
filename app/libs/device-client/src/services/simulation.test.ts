import { read } from 'fs';
import { NoiseSimulationType, SimulationType } from '../common/types';
import { BaseSimulator, ConstSimulationProperties, DataSimulator } from './simulation';

describe('BaseSimulator', () => {
  it('should initialize with the correct tag', () => {
    const simulator = new BaseSimulator('test-tag');
    expect(simulator.tag).toBe('test-tag');
  });

  it('should handle boolean tags', async () => {
    process.env.SIMULATION_MS = '1';
    let readValue = false;
    const dataSimulator = new DataSimulator(
      'tag1',
      'boolean',
      async (t, v, ts) => {
        readValue = !!v;
        return false;
      },
      {
        type: SimulationType.CONST,
        value: true,
      }
    );
    // await 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(readValue).toBe(true);

    DataSimulator.clear();
  });

  it('booleans with noise', async () => {
    process.env.SIMULATION_MS = '1';
    let readValue = true;
    let flipped = 0;
    const dataSimulator = new DataSimulator(
      'tag1',
      'boolean',
      async (t, v, ts) => {
        if ((!!v) != readValue) {
          readValue = !!v;
          flipped++;
        }
        return false;
      },
      {
        type: SimulationType.CONST,
        value: true,
        noise: {
          type: NoiseSimulationType.ABSOLUTE,
          amplitude: 100,
        }
      }
    );
    // await 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(flipped).toBeGreaterThan(0);

    DataSimulator.clear();
  });

  it ('should simulate arrays', async () => {
    process.env.SIMULATION_MS = '1';
    let readValue;
    const dataSimulator = new DataSimulator(
      'tag1',
      'doublearray',
      async (t, v, ts) => {
        readValue = v;
        return false;
      },
      {
        type: SimulationType.CONST,
        value: true,
        noise: {
          type: NoiseSimulationType.ABSOLUTE,
          amplitude: 100,
        }
      }
    );

    // await 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(Object.getPrototypeOf(readValue)).toBe(Object.getPrototypeOf([]));

    DataSimulator.clear();
    
  });

});
