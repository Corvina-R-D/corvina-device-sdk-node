import Mustache from "mustache";

import {
    AlarmDesc,
    AlarmState,
    AlarmData,
    MultiLangString,
    SimulationDesc,
    SimulationType,
    NoiseSimulationType,
} from "../common/types";

//import ease from 'd3-ease'
const ease = require("d3-ease");
import _ from "lodash";
import { clearInterval } from "timers";
import { l } from "./logger.service";

enum StepSimulationState {
    STABLE,
    TRANSITION,
}

interface StepSimulationStateMachine {
    state: StepSimulationState;
    origin: number;
    target: number;
    current: number;
    duration: number;
    start: number;
}

export interface StepSimulationProperties extends SimulationDesc {
    amplitude: number;
    offset: number;
    easing: string;
    easingProps?: any;
    jump_probability: number; // 1: never jump, 0: jump every second, 0.5 jumps every X seconds on avg, 0.1 jumps every 10 sec on avg
    dt_min: number;
    dt_max: number;
    state?: StepSimulationStateMachine;
}

export interface SineSimulationProperties extends SimulationDesc {
    amplitude: number;
    offset: number;
    period: number;
    phase: number;
}

export interface FunctionSimulationProperties extends SimulationDesc {
    f: string;
    _f?: ($: any) => any;
}

export interface ConstSimulationProperties extends SimulationDesc {
    value: number;
}

interface AbstractSimulator {
    loop();
}

export class BaseSimulator implements AbstractSimulator {
    public tag: string;

    /*! dependees: exiting dependency edges in dep graph */
    public depsOut: Map<string, BaseSimulator>;

    public value: any;
    public lastSentValue: any;

    static simulators = new Array<BaseSimulator>();
    static simulatorsByTagName: Map<string, BaseSimulator>;

    static inited = false;
    static sorted = false;
    static intervalID = null;

    static filterDuplications: boolean;
    static simulationMs: number;

    constructor(tag: string) {
        this.tag = tag;

        if (!BaseSimulator.simulatorsByTagName) {
            BaseSimulator.simulatorsByTagName = new Map<string, BaseSimulator>();
        }

        BaseSimulator.filterDuplications = !!(() => {
            try {
                return JSON.parse(process.env.FILTER_DUPS);
            } catch (err) {
                return true;
            }
        })();
        BaseSimulator.simulationMs = (() => {
            try {
                return JSON.parse(process.env.SIMULATION_MS);
            } catch (err) {
                return 1000;
            }
        })();
        if (!BaseSimulator.inited) {
            BaseSimulator.intervalID = setInterval(() => {
                if (!BaseSimulator.inited || !BaseSimulator.sorted) {
                    let idx = BaseSimulator.simulatorsByTagName.size;
                    BaseSimulator.simulators = new Array(idx);

                    for (const [k, d] of BaseSimulator.simulatorsByTagName) {
                        (d as any).visited = false;
                    }

                    const visit = (n: BaseSimulator): boolean => {
                        if ((n as any).visited == true) {
                            return false;
                        }
                        (n as any).visited = true;

                        if (n.depsOut) {
                            for (const [k, v] of n.depsOut) {
                                visit(v);
                            }
                        }
                        idx--;
                        if (idx < 0) {
                            return false;
                        }
                        BaseSimulator.simulators[idx] = n;
                        return true;
                    };

                    for (const [k, d] of BaseSimulator.simulatorsByTagName) {
                        visit(d);
                    }

                    BaseSimulator.sorted = true;
                }

                BaseSimulator.simulators.forEach((value) => {
                    try {
                        value.loop();
                    } catch (e) {
                        l.error("Error in simulation:");
                        l.error(e);
                    }
                });
            }, BaseSimulator.simulationMs);
            BaseSimulator.inited = true;
        }
    }

    /*! Getter function to access cached value from other simulators by tag name */
    static $ = (source: BaseSimulator, tagName: string) => {
        const target: BaseSimulator = BaseSimulator.simulatorsByTagName.get(tagName);
        if (target == undefined) {
            l.error(`Cannot resolve dependency ${tagName}`);
            return;
        }
        if (!target.depsOut) {
            target.depsOut = new Map<string, BaseSimulator>();
        }

        if (!target.depsOut.has(source.tag)) {
            l.debug(`Tracked dependency from ${source.tag} to ${target.tag}`);
            target.depsOut.set(source.tag, source);
            BaseSimulator.sorted = false;
        }
        return target.value;
    };

    loop() {
        // default implementation do nothing
    }
}

export class DataSimulator extends BaseSimulator {
    private callback: (tagName: string, value: number, ts: number) => Promise<boolean>;
    private type;
    private defAmplitude;
    private defPhase;
    private defPeriod;
    private desc: SimulationDesc;

    constructor(
        tag: string,
        type: string,
        callback: (tagName: string, value: number, ts: number) => Promise<boolean>,
        desc: SimulationDesc,
    ) {
        super(tag);

        this.type = type;
        this.desc = desc;

        DataSimulator.simulatorsByTagName.set(tag, this);

        if (tag.indexOf(".") >= 0) {
            const structName = tag.split(".")[0];
            let structSimulator = DataSimulator.simulatorsByTagName.get(structName);
            if (!structSimulator) {
                // split structures
                structSimulator = new DataSimulator(structName, "struct", callback, desc);
            }
            BaseSimulator.$(this, structName);
            // do not set the callback function for single properties, always notify the whole structure
        } else {
            this.callback = callback;
        }

        this.defAmplitude = 500 * Math.random();
        this.defPhase = Math.random() * 4 * Math.PI;
        this.defPeriod = Math.random() * 30000;
    }

    applyNoise(v: number | boolean | string, min = -Infinity, max = Infinity): number | boolean | string {
        const props = this.desc as SimulationDesc;
        if (props.noise) {
            const rand = Math.random();
            if (typeof v == "boolean") {
                let noised = Number(v);
                if (props.noise.type == NoiseSimulationType.ABSOLUTE) {
                    noised = (~~(noised + rand * props.noise.amplitude)) % 2;
                } else {
                    noised = (~~(noised + rand * ((noised * props.noise.amplitude) / 100))) % 2;
                }
                if (noised < min) {
                    return min;
                }
                if (noised > max) {
                    return max;
                }
                return !!noised;
            }
            let noised = v as number;
            if (props.noise.type == NoiseSimulationType.ABSOLUTE) {
                noised = noised + (rand - 0.5) * props.noise.amplitude;
            } else {
                noised = noised + (rand - 0.5) * ((noised * props.noise.amplitude) / 100);
            }
            if (noised < min) {
                return min;
            }
            if (noised > max) {
                return max;
            }
            return noised;
        }
        return v as number;
    }

    nullify(v: any, callback: (nullifyingPrev: boolean, nullifyingCurrent: boolean) => void = null): any {
        const props = this.desc as SimulationDesc;
        if (props.nullable) {
            if (!props.nullable.state) {
                props.nullable.state = {
                    nullifying: false,
                    duration: 0,
                    start: 0,
                };
            }
            const oldState = props.nullable.state.nullifying;
            const dice = Math.random();
            const now = Date.now();
            if (!props.nullable.state.nullifying) {
                if (dice < props.nullable.probability) {
                    props.nullable.state.nullifying = true;
                    props.nullable.state.start = now;
                    props.nullable.state.duration =
                        BaseSimulator.simulationMs *
                        (props.nullable.dt_min + Math.random() * (props.nullable.dt_max - props.nullable.dt_min));
                }
            } else {
                if (now > props.nullable.state.start + props.nullable.state.duration) {
                    props.nullable.state.nullifying = false;
                }
            }
            if (callback) {
                callback(oldState, props.nullable.state.nullifying);
            }
            if (props.nullable.state.nullifying == true) {
                if (typeof v == "number") {
                    return 0;
                } else if (typeof v == "boolean") {
                    return false;
                } else {
                    return "";
                }
            }
        }
        return v;
    }

    async loop() {
        const ts = Date.now();
        this.value = null;
        if (this.type == "struct") {
            // get all deps
            if (!this.value) {
                this.value = {};
            }
            Array.from(this.depsOut.values()).forEach((x) => {
                this.value[x.tag.slice(this.tag.length + 1)] = x.value;
            });
        } else {
            if (!this.desc) {
                switch (this.type) { // default to sine
                    case "integer":
                        this.value = (Math.random() * this.defAmplitude) | 0;
                        break;
                    case "boolean":
                        this.value = Math.random() > 0.5;
                        break;
                    case "double":
                        this.value = this.defAmplitude * Math.sin(this.defPhase + (ts * 2 * Math.PI) / this.defPeriod);
                        break;
                    case "string":
                        this.value = Math.random().toString();
                        break;
                    case "integerarray":
                        this.value = _.range(0, 10).map((x) => (Math.round(Math.random() * this.defAmplitude)));
                        break;
                    case "doublearray":
                        this.value = _.range(0, 10).map((x) => (Math.random() * this.defAmplitude));
                        break;
                    case "stringarray":
                        this.value = _.range(0, 10).map((x) => (Number(Math.random() * this.defAmplitude).toFixed()));
                        break;
                    case "booleanarray":
                        this.value = _.range(0, 10).map((x) => Math.random()> 0.5);
                        break;
                    default:
                        throw "Unsupported type " + this.type;
                }
            } else {
                switch (this.desc.type) {
                    case SimulationType.FUNCTION:
                        {
                            const props = this.desc as FunctionSimulationProperties;
                            try {
                                if (!props._f) {
                                    props._f = new Function("$", props.f) as () => any;
                                }
                                this.value = props._f.call(this, (t) => {
                                    return BaseSimulator.$(this, t);
                                });
                            } catch (e) {
                                l.error("Error evaluating simulation function:");
                                l.error(e);
                            }
                            if (this.value == null || this.value == undefined) {
                                return;
                            }

                            const noised = this.applyNoise(this.value);
                            switch (this.type) {
                                case "integer":
                                    this.value = ~~noised;
                                    break;
                                case "boolean":
                                    this.value = !!noised;
                                    break;
                                case "double":
                                    this.value = noised;
                                    break;
                                case "string":
                                    this.value =
                                        typeof noised == "string" || (noised as any) instanceof String
                                            ? noised
                                            : JSON.stringify(noised);
                                    break;
                                case "integerarray":
                                case "doublearray":
                                    this.value = Array.isArray(this.value) ? this.value : [Number(this.value)];
                                    break;
                                case "booleanarray":
                                    this.value = Array.isArray(this.value) ? this.value.map(v=>v==true) : [this.value==true];
                                    break;
                                default:
                                    throw "Unsupported type " + this.type;
                            }
                            this.value = this.nullify(this.value);
                        }
                        break;
                    case SimulationType.CONST:
                        {
                            const props = this.desc as ConstSimulationProperties;
                            const noised = this.applyNoise(props.value);
                            switch (this.type) {
                                case "integer":
                                    this.value = ~~noised;
                                    break;
                                case "boolean":
                                    this.value = !!noised;
                                    break;
                                case "double":
                                    this.value = noised;
                                    break;
                                case "string":
                                    this.value =
                                        typeof noised == "string" || (noised as any) instanceof String
                                            ? noised
                                            : JSON.stringify(noised);
                                    break;
                                case "integerarray":
                                case "doublearray":
                                    this.value = Array.isArray(this.value) ? this.value : [Number(this.value)];
                                    break;
                                case "booleanarray":
                                    this.value = Array.isArray(this.value) ? this.value.map(v=>v==true) : [this.value==true];
                                    break;
                                default:
                                    throw "Unsupported type " + this.type;
                            }
                            this.value = this.nullify(this.value);
                        }
                        break;
                    case SimulationType.SINE:
                        {
                            const props = this.desc as SineSimulationProperties;
                            const v = this.applyNoise(
                                props.offset +
                                    props.amplitude *
                                        Math.sin(
                                            props.phase +
                                                (ts * 2 * Math.PI) / (BaseSimulator.simulationMs * props.period),
                                        ),
                            );
                            switch (this.type) {
                                case "integer":
                                    this.value = ~~v;
                                    this.value = this.nullify(this.value);
                                    break;
                                case "boolean":
                                    this.value = !!v;
                                    break;
                                case "double":
                                    this.value = v;
                                    break;
                                case "string":
                                    this.value =
                                        typeof v == "string" || (v as any) instanceof String ? v : JSON.stringify(v);
                                    break;
                                default:
                                    throw "Unsupported type " + this.type;
                            }
                            this.value = this.nullify(this.value);
                        }
                        break;
                    case SimulationType.STEP:
                        {
                            const props = this.desc as StepSimulationProperties;
                            const f = ease[props.easing];
                            if (props.easingProps) {
                                Object.assign(f, props.easingProps);
                            }
                            const fun = f as (number) => number;

                            const computeNewTarget = () => {
                                props.state.state = StepSimulationState.TRANSITION;
                                props.state.origin = props.state.current;
                                const rand = Math.random() - 0.5;
                                props.state.target = props.state.origin + rand * props.amplitude;
                                if (props.state.target > props.offset + props.amplitude) {
                                    props.state.target = props.state.origin - rand * props.amplitude;
                                }
                                if (props.state.target < props.offset) {
                                    props.state.target = props.state.origin - rand * props.amplitude;
                                }
                                const rand2 = Math.random();
                                props.state.duration =
                                    BaseSimulator.simulationMs * (props.dt_min + rand2 * (props.dt_max - props.dt_min));
                                props.state.start = ts;
                            };

                            if (!props.state) {
                                (props as any).state = {};
                                props.state.current = props.offset + props.amplitude / 2;
                                // initialize state
                                computeNewTarget();
                            }

                            const jumpRand = Math.random();
                            if (jumpRand < props.jump_probability) {
                                // jump!!!
                                computeNewTarget();
                            }

                            let v = props.offset;
                            if (props.state.state == StepSimulationState.TRANSITION) {
                                const dt = ts - props.state.start;
                                if (dt > props.state.duration) {
                                    props.state.state = StepSimulationState.STABLE;
                                    v = props.state.target;
                                } else {
                                    props.state.current =
                                        props.state.origin +
                                        (props.state.target - props.state.origin) * fun(dt / props.state.duration);
                                    v = props.state.current;
                                }
                            } else {
                                v = props.state.current;
                            }

                            const noised = this.applyNoise(v, props.offset, props.offset + props.amplitude);

                            switch (this.type) {
                                case "integer":
                                    this.value = ~~noised;
                                    break;
                                case "boolean":
                                    this.value = !!noised;
                                    break;
                                case "double":
                                    this.value = noised;
                                    break;
                                case "string":
                                    this.value =
                                        typeof noised == "string" || (noised as any) instanceof String
                                            ? noised
                                            : JSON.stringify(noised);
                                    break;
                                default:
                                    throw "Unsupported type " + this.type;
                            }

                            this.nullify(this.value, (o: boolean, n: boolean) => {
                                if (n == true) {
                                    this.value = 0;
                                }
                                if (o == true && n == false) {
                                    this.value = props.offset;
                                    props.state.current = props.offset;
                                    computeNewTarget();
                                }
                            });
                        }
                        break;
                }
            }
        }

        if (!BaseSimulator.filterDuplications || JSON.stringify(this.value) != JSON.stringify(this.lastSentValue)) {
            try {
                if (this.callback && (await this.callback(this.tag, this.value, ts))) {
                    this.lastSentValue = this.value;
                }
            } catch (e) {
                console.log(e);
            }
        }
    }

    static clear() {
        BaseSimulator.sorted = false;
        BaseSimulator.inited = false;
        BaseSimulator.simulatorsByTagName && BaseSimulator.simulatorsByTagName.clear();
        clearInterval(BaseSimulator.intervalID);
    }
}

export class AlarmSimulator extends BaseSimulator {
    private callback: (AlarmDesc) => Promise<boolean>;
    private alarm: AlarmDesc;
    private alarmData: AlarmData;
    private tagRefs: any;

    static alarmSimulatorMapkey(alarmName: string) {
        return `Alarm.${alarmName}`;
    }

    constructor(alarm: AlarmDesc, callback: (AlarmData) => Promise<boolean>) {
        super(alarm.source);

        this.alarm = alarm;
        this.alarm.enabled = true;

        this.callback = callback;

        this.alarmData = {
            sev: this.alarm.severity,
            tag: this.alarm.source,
            name: this.alarm.name,
            state: this.alarm.enabled ? AlarmState.ALARM_ENABLED : AlarmState.ALARM_NONE,
        } as any as AlarmData;

        if (this.alarm.desc && this.alarm.desc["en"]) {
            this.tagRefs = {};
            const tokens = Mustache.parse(this.alarm.desc["en"], ["[", "]"]);
            for (const t of tokens) {
                if (t[0] == "name") {
                    this.tagRefs[t[1]] = null;
                }
            }
        }

        BaseSimulator.simulatorsByTagName.set(AlarmSimulator.alarmSimulatorMapkey(alarm.name), this);
    }

    // Case ack required and reset required
    //   ! active ! acked !ack_required  !reset_required
    //   activate! => active !acked ack_required !reset_required
    //   ack! => active acked !ack_required  reset_required
    //   reset! => FAILS (need to be inactive)
    //   deactivate! => !active acked !ack_required  reset_required
    //   reset! => !active !acked !ack_required  !reset_required

    //   ! active ! acked !ack_required  !reset_required
    //   activate! => active !acked ack_required !reset_required
    //   ack! => active acked !ack_required !reset_required
    //   deactivate! => !active acked !ack_required reset_required
    //   reset! => !active !acked !ack_required  !reset_required

    //   ! active ! acked !ack_required  !reset_required
    //   activate! => active !acked ack_required !reset_required
    //   deactivate! => !active !acked ack_required  !reset_required
    //   ack! => !active acked !ack_required reset_required
    //   reset! => !active !acked !ack_required  !reset_required

    // Case ack required, reset not required
    //   ! active ! acked !ack_required  !reset_required
    //   activate! => active !acked ack_required !reset_required
    //   ack! => active acked !ack_required !reset_required
    //   deactivate! => !active acked !ack_required  !reset_required

    //   ! active ! acked !ack_required  !reset_required
    //   activate! => active !acked ack_required !reset_required
    //   deactivate! => !active !acked ack_required !reset_required
    //   ack! => !active acked !ack_required  !reset_required

    acknoledge(evTs: number, user: string, comment: string) {
        if (evTs != this.alarmData.evTs.valueOf()) {
            l.warn(
                `Trying to reset alarm ${this.alarmData.name}:${evTs} but current active event timestamp is ${this.alarmData.evTs}`,
            );
            // propagate a fake sync (assuming the alarm event is not closed)
            const fakeAck: AlarmData = {
                name: this.alarmData.name,
                desc: this.alarmData.desc,
                ts: new Date(),
                evTs: new Date(evTs),
                sev: this.alarmData.sev,
                tag: this.alarmData.tag,
                state: AlarmState.ALARM_ENABLED,
            };
            this.callback(fakeAck);
        } else {
            if (this.alarmData.state & AlarmState.ALARM_REQUIRES_ACK) {
                this.alarmData.state &= ~AlarmState.ALARM_REQUIRES_ACK;
                this.alarmData.state |= AlarmState.ALARM_ACKED;
                if (this.alarm.reset_required) {
                    this.alarmData.state |= AlarmState.ALARM_REQUIRES_RESET;
                }
                l.info(`Alarm ${this.alarmData.name} acknowledged by ${user} : ${comment}`);

                this.propagate();
            } else {
                l.warn(`Alarm ${this.alarmData.name} does not require ack`);
            }
        }
    }

    reset(evTs: number, user: string, comment: string) {
        if (evTs != this.alarmData.evTs.valueOf()) {
            l.warn(
                `Trying to reset alarm ${this.alarmData.name}:${evTs} but current active event timestamp is ${this.alarmData.evTs}`,
            );
            // propagate a fake sync (assuming the alarm event is not closed)
            const fakeReset: AlarmData = {
                name: this.alarmData.name,
                desc: this.alarmData.desc,
                ts: new Date(),
                evTs: new Date(evTs),
                sev: this.alarmData.sev,
                tag: this.alarmData.tag,
                state: AlarmState.ALARM_ENABLED,
            };
            this.callback(fakeReset);
        } else {
            if (this.alarmData.state & AlarmState.ALARM_REQUIRES_RESET) {
                if (!(this.alarmData.state & AlarmState.ALARM_ACTIVE)) {
                    this.alarmData.state &= ~(AlarmState.ALARM_ACKED | AlarmState.ALARM_REQUIRES_RESET);
                    l.info(`Alarm ${this.alarmData.name} reset by ${user} : ${comment}`);
                    this.propagate();
                } else {
                    l.warn(`Cannot reset active alarm ${this.alarmData.name}`);
                }
            } else {
                l.warn(`Alarm ${this.alarmData.name} does not require reset`);
            }
        }
    }

    disable() {
        this.alarmData.state &= ~(
            AlarmState.ALARM_ENABLED |
            AlarmState.ALARM_ACKED |
            AlarmState.ALARM_REQUIRES_ACK |
            AlarmState.ALARM_REQUIRES_RESET
        );
    }

    enable() {
        this.alarmData.state |= AlarmState.ALARM_ENABLED;
        this.loop();
    }

    private async propagate() {
        try {
            const tagValue = BaseSimulator.$(this, this.alarm.source);
            switch (typeof tagValue) {
                case "number":
                    this.alarmData.v_d = tagValue;
                    break;
                case "string":
                    this.alarmData.v_s = tagValue;
                    break;
                case "boolean":
                    this.alarmData.v_b = tagValue;
                    break;
                default:
                    throw "Unsupported type " + typeof tagValue;
            }

            if (this.tagRefs) {
                for (const r in this.tagRefs) {
                    this.tagRefs[r] = BaseSimulator.$(this, r);
                }
                this.alarmData.desc = Mustache.render(this.alarm.desc["en"], this.tagRefs, {}, ["[", "]"]);
            }
            this.alarmData.ts = new Date();

            if (await this.callback(this.alarmData)) {
                l.debug("Updated alarm value %j %j %j", this.lastSentValue, this.value, this.alarmData);
            }
        } catch (e) {
            l.error("Error propagating data");
            l.error(e);
        }
    }

    async loop() {
        if (!this.alarm.simulation) {
            return;
        }

        const ts = Date.now();
        this.value = null;
        {
            const props = this.alarm.simulation as FunctionSimulationProperties;
            try {
                if (!props._f) {
                    // _f is a function with parameters $ and $src and body props.f
                    props._f = new Function("$", "$src", props.f) as () => any;
                }
                // call _f passing the function to resolve simulator by tag name as $, and $src the reference to tag source
                this.value = props._f.call(this, (t) => {
                    return BaseSimulator.$(this, t), BaseSimulator.$(this, this.alarm.source);
                });
            } catch (e) {
                l.error("Error evaluating alarm function");
                l.error(e);
            }
            if (this.value == null || this.value == undefined) {
                return;
            }
        }

        const changedValue = JSON.stringify(this.value) != JSON.stringify(this.lastSentValue);

        if (changedValue) {
            if (this.value) {
                this.alarmData.state |= AlarmState.ALARM_ACTIVE;
            } else {
                this.alarmData.state &= ~AlarmState.ALARM_ACTIVE;
            }

            if (
                this.alarmData.state & AlarmState.ALARM_ACTIVE &&
                !(this.alarmData.state & (AlarmState.ALARM_REQUIRES_ACK | AlarmState.ALARM_REQUIRES_RESET))
            ) {
                // set a new event timestamp
                this.alarmData.evTs = new Date();
            }

            if (this.alarm.ack_required && this.value && !(this.alarmData.state & AlarmState.ALARM_ACKED)) {
                this.alarmData.state |= AlarmState.ALARM_REQUIRES_ACK;
            }

            /// reset ack status if not enabled
            if (!this.alarm.enabled && !this.value) {
                this.alarmData.state &= ~AlarmState.ALARM_REQUIRES_ACK;
            }

            if (this.alarm.enabled && this.alarmData.evTs) {
                await this.propagate();
            }
            this.lastSentValue = this.value;
        }
    }
}
