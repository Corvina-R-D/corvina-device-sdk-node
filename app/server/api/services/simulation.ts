import { version } from "bluebird";

//import ease from 'd3-ease'
const ease  = require('d3-ease')


enum StepSimulationState
{
    STABLE,
    TRANSITION
}

interface StepSimulationStateMachine {
    state: StepSimulationState,
    origin: number,
    target: number,
    current: number,
    duration: number,
    start: number
}


enum NoiseSimulationType {
    ABSOLUTE = "abs",
    PERCENT = "%"
}

export interface NoiseSimulationProperties
{
    type: NoiseSimulationType
    amplitude: number
}


interface NullableSimulationStateMachine {
    nullifying: boolean
    start: number
    duration: number
}

export interface NullableSimulationProperties
{
    probability: number
    dt_min: number
    dt_max: number
    state ?: NullableSimulationStateMachine
}


enum SimulationType {
    SINE = "sine",
    STEP = "step",
    CONST = "const"
}


export interface SimulationDesc {
    type: SimulationType,
    noise: NoiseSimulationProperties
    nullable: NullableSimulationProperties
}

export interface StepSimulationProperties extends SimulationDesc
{
    amplitude: number,
    offset: number,
    easing: string,
    easingProps ?: any,
    jump_probability: number, // 1: never jump, 0: jump every second, 0.5 jumps every X seconds on avg, 0.1 jumps every 10 sec on avg
    dt_min: number, 
    dt_max: number,
    state ?: StepSimulationStateMachine    
}

export interface SineSimulationProperties extends SimulationDesc
{
    amplitude: number,
    offset: number,
    period: number,
    phase: number
}

export interface ConstSimulationProperties extends SimulationDesc
{
    value: number
}



export class DataSimulator {
    private callback: (tagName: string, value: number, ts: number) => Promise<boolean>;
    private type;
    private tag;
    private defAmplitude;
    private defPhase;
    private defPeriod;
    private desc : SimulationDesc;
    private lastSentValue : any;
    private filterDuplications : boolean;

    static simulators = new Array<DataSimulator>();
    static inited = false;

    constructor(tag: string, type: string, callback: (tagName: string, value: number, ts: number) => Promise<boolean>, desc: SimulationDesc) {
        this.tag = tag;
        this.type = type;
        this.callback = callback;
        this.desc = desc

        this.filterDuplications = !!(() => { try { return JSON.parse(process.env.FILTER_DUPS) } catch (err) { return true } })()

        DataSimulator.simulators.push(this)

        this.defAmplitude = 500 * Math.random();
        this.defPhase = Math.random() * 4 * Math.PI
        this.defPeriod = Math.random() * 30000;

        if (!DataSimulator.inited) {
            setInterval(() => {
                DataSimulator.simulators.forEach((value) => { value.loop() })
            }, 1000);
            DataSimulator.inited = true;
        }

    }

    applyNoise(v: number): number {
        const props = this.desc as SimulationDesc
        if (props.noise) {
            if (props.noise.type == NoiseSimulationType.ABSOLUTE) {
                return v + (Math.random() - 0.5) * props.noise.amplitude
            } else {
                return v + (Math.random() - 0.5) * (v * props.noise.amplitude / 100)
            }
        }
        return v
    }

    nullify(v: any, callback: (nullifyingPrev: boolean, nullifyingCurrent: boolean) => void = null): any {
        const props = this.desc as SimulationDesc
        if (props.nullable) {
            if (!props.nullable.state) {
                props.nullable.state =  { nullifying: false, duration: 0, start: 0}
            }
            const oldState = props.nullable.state.nullifying
            const dice = Math.random()
            const now = Date.now()
            if (!props.nullable.state.nullifying) {
                if (dice < props.nullable.probability) {
                    props.nullable.state.nullifying = true
                    props.nullable.state.start = now
                    props.nullable.state.duration = 1000 * ( props.nullable.dt_min + Math.random() * ( props.nullable.dt_max - props.nullable.dt_min) )
                }
            } else {
                if ( now > (props.nullable.state.start + props.nullable.state.duration)) {
                    props.nullable.state.nullifying = false
                }
            }
            if (callback) {
                callback(oldState, props.nullable.state.nullifying)
            }
            if (props.nullable.state.nullifying == true) {
                if (typeof v == 'number') {
                    return  0
                } else {
                    return ""
                }
            }
        }
        return v;
    }

    async loop() {
        //console.log("loop!!!")
        const ts = Date.now()
        let value = null;
        if (!this.desc) {
            switch (this.type) {
                case 'integer':
                    value = (Math.random() * this.defAmplitude) | 0;
                    break;
                case 'double':
                    value = this.defAmplitude * Math.sin(this.defPhase + ts * 2 * Math.PI / this.defPeriod)
                    break;
                case 'string':
                    value = Math.random().toString();
                    break;
            }
        } else {
            switch (this.desc.type) {
                case SimulationType.CONST:
                    {
                        let props = this.desc as ConstSimulationProperties
                        let noised = this.applyNoise(props.value)
                        switch (this.type) {
                            case 'integer':
                                value = ~~noised;
                                break;
                            case 'double':
                                value = noised;
                                break;
                            case 'string':
                                value = (typeof noised == 'string' || ((noised as any) instanceof String )) ? noised : JSON.stringify(noised);
                                break;
                        }
                        value = this.nullify(value)
                    }
                    break;
                case SimulationType.SINE:
                    {
                        let props = this.desc as SineSimulationProperties
                        let v = this.applyNoise(props.offset + props.amplitude * Math.sin(props.phase + ts * 2 * Math.PI / (1000 * props.period)))
                        switch (this.type) {
                            case 'integer':
                                value = ~~v;
                                value = this.nullify(value)
                                break;
                            case 'double':
                                value = v;
                                break;
                            case 'string':
                                value = (typeof v == 'string' || ((v as any) instanceof String )) ? v : JSON.stringify(v);
                                break;
                        }
                        value = this.nullify(value)
                    }
                    break;
                case SimulationType.STEP:
                    {
                        let props = this.desc as StepSimulationProperties
                        let f = ease[props.easing]
                        if (props.easingProps) {
                            Object.assign(f, props.easingProps)
                        }
                        let fun = f as ((number) => number)

                        const computeNewTarget = () => {
                            props.state.state = StepSimulationState.TRANSITION
                            props.state.origin = props.state.current
                            const rand = (Math.random() - 0.5)
                            props.state.target = props.state.origin + rand * props.amplitude
                            if (props.state.target > props.offset + props.amplitude) {
                                props.state.target = props.offset + props.amplitude
                            }
                            if (props.state.target < props.offset) {
                                props.state.target = props.offset
                            }
                            const rand2 = Math.random()
                            props.state.duration = 1000 * (props.dt_min + (rand2 * (props.dt_max - props.dt_min)))
                            props.state.start = ts
                        }

                        if (!props.state) {
                            (props as any).state = {}
                            props.state.current = props.offset + props.amplitude / 2
                            // initialize state
                            computeNewTarget()
                        }

                        const jumpRand = Math.random()
                        if (jumpRand < props.jump_probability) {
                            // jump!!!
                            computeNewTarget()
                        }

                        let v = props.offset
                        if (props.state.state == StepSimulationState.TRANSITION) {
                            let dt = ts - props.state.start
                            if (dt > props.state.duration) {
                                props.state.state = StepSimulationState.STABLE
                                v = props.state.target
                            } else {
                                props.state.current = props.state.origin + (props.state.target - props.state.origin) * fun(dt / props.state.duration);
                                v = props.state.current
                            }
                        } else {
                            v = props.state.current
                        }
                        let noised = this.applyNoise(v)

                        switch (this.type) {
                            case 'integer':
                                value = ~~noised;
                                break;
                            case 'double':
                                value = noised;
                                break;
                            case 'string':
                                value = (typeof noised == 'string' || ((noised as any) instanceof String ))  ? noised : JSON.stringify(noised);
                                break;
                        }

                        value = this.nullify(value, (o: boolean, n: boolean) => {
                            if (o == true && n == false) {
                                props.state.current = props.offset
                                computeNewTarget()
                            }
                        })
                    }
                    break;
            }
        }
        if ( !this.filterDuplications || JSON.stringify(value) != JSON.stringify(this.lastSentValue)) {
            try {
                if ( await this.callback(this.tag, value, ts) )
                    this.lastSentValue = value;
            } catch(e) {}
        }
    }


    static clear() {
        DataSimulator.simulators = new Array<DataSimulator>();
    }
}

export default DataSimulator;
