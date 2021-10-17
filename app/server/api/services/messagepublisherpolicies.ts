import { Timestamp } from 'bson';
import _ from 'lodash';

export type StateTS = number;
export const INVALID_STATE_TS = Number.MAX_SAFE_INTEGER;


export enum Quality {
    GOOD,
    UNCERTAIN,
    BAD
}
export class State {
    value : any;
    timestamp: StateTS;

    get quality() : Quality {
        if (this.value != undefined) {
            return Quality.GOOD
        }
        return Quality.UNCERTAIN
    }

    public clone() {
        let s = new State;
        s.value = this.value;
        s.timestamp = this.timestamp;
        return s;
    }
}

/** Base class of message publish policies */
export abstract class MessagePublisherPolicy
{
    protected _nextTime: StateTS;

    constructor() {
        this._nextTime = INVALID_STATE_TS;
    }

    abstract updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS;
    
    public get nextTime() { return this._nextTime; }

    public rearm(currentTime: StateTS) : StateTS {
        this._nextTime = INVALID_STATE_TS;
        return this._nextTime;
    }

	/*! Return all tag referenced by this policy */
    public referencedTags(referencedTags: string[]) {}
	/*! Set the tagname is currently empty */
	public setDefaultTagName(tagName: string) {}
	/*! Set the tagname of a field */
	public setFieldTagName( {fieldName, tagName} : {fieldName: string, tagName: string} ) {}


	/*! Returns a multi tag version, for instance if the type is qualitygood, returns 
	 * a AND of each single tag */
	public multiTagVersion(tags: string[])  { 
        return this.clone(); 
    }

    public clone() {
        return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
    }

};

export abstract class MessagePublisher_OperatorPolicy extends MessagePublisherPolicy
{

    constructor(operands ?: MessagePublisherPolicy[]) {
        super ();
        this._operands = operands;
    }

    public addOperand(op: MessagePublisherPolicy) {
        this._operands.push(op)
    }

    public operand(i: number) : MessagePublisherPolicy  {
        return this._operands[i]
    }

    public referencedTags(referencedTags: string[]) {
        this._operands.forEach(o => o.referencedTags(referencedTags))
    }

    public setDefaultTagName(tagName: string) {
        this._operands.forEach(o => o.setDefaultTagName(tagName))
    }

    public setFieldTagName({fieldName, tagName} : {fieldName: string, tagName: string}) {
        this._operands.forEach(o => o.setFieldTagName( {fieldName, tagName}))
    }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        return INVALID_STATE_TS;
    }

    public multiTagVersion(tags: string[])  { 
        let clone : MessagePublisher_OperatorPolicy = <MessagePublisher_OperatorPolicy>this.clone();
        clone._operands.map((o) => o.multiTagVersion(tags))
        return clone;
    }

	protected clear() {
        this._operands = []
    };

    abstract operatorKeyword() : string;

    public toString() : string
    {
        let ret : string;
        for(let i =0; i < this._operands.length; i++) {
            ret += i == 0 ? '(' : ` ${this.operatorKeyword()} ` + `${this._operands[i].toString()})`;
        }
        return ret
    }

	protected _operands : MessagePublisherPolicy[];

    public clone() {
        let cloned = <MessagePublisher_OperatorPolicy>( super.clone() );
        cloned._operands = cloned._operands.map( (o) => o.clone())
        return cloned;
    }
};

/*! And-Logic composition of policies => apply max operator on next time operands */
export class MessagePublisher_AndPolicy extends MessagePublisher_OperatorPolicy
{
    constructor(operands ?: MessagePublisherPolicy[]) {
        super (operands);
    }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        this._nextTime = 0;
        this._operands.forEach(o => {
            const bTime = o.updateState( {tagName, newState, currentTime})
            this._nextTime = this._nextTime < bTime ? bTime : this._nextTime;
        })
        return this._nextTime;
    }


    public rearm(currentTime: StateTS) : StateTS {
        this._nextTime = 0;
        this._operands.forEach(o => {
            const bTime = o.rearm(currentTime)
            this._nextTime = this._nextTime < bTime ? bTime : this._nextTime;
        })
        return this._nextTime;

    }

	operatorKeyword() { return "AND"; }

};

/*! And-Logic composition of policies => apply max operator on next time operands */
export class MessagePublisher_OrPolicy extends MessagePublisher_OperatorPolicy
{
    constructor(operands ?: MessagePublisherPolicy[]) {
        super (operands);
    }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        this._nextTime = INVALID_STATE_TS;
        this._operands.forEach(o => {
            const bTime = o.updateState( {tagName, newState, currentTime})
            this._nextTime = this._nextTime < bTime ? this._nextTime : bTime;
        })
        return this._nextTime;
    }


    public rearm(currentTime: StateTS) : StateTS {
        this._nextTime = INVALID_STATE_TS;
        this._operands.forEach(o => {
            const bTime = o.rearm(currentTime)
            this._nextTime = this._nextTime < bTime ? this._nextTime : bTime;
        })
        return this._nextTime;

    }

	operatorKeyword() { return "OR"; }

};


abstract class MessagePublisher_TagBasedPolicy extends MessagePublisherPolicy
{
    constructor(tagName ?: string) {
        super();
        this._tagName = tagName;
    }

    get tagName() { return this._tagName; }

	/*! Set the tagname if currently empty */
	public setDefaultTagName(tagName: string) {
		if (!this._tagName || this._tagName.length === 0) {
			this._tagName = tagName;
		}
	}

	/*! Return all tag referenced by this policy */
	public referencedTags(referencedTags: string[]) {
		if (this._tagName && this._tagName.length !== 0)
			referencedTags.push(this._tagName);
	}

    public multiTagVersion(tags: string[]) {
        if (this._tagName && this._tagName.length > 0) {
            // default tag name is already set (setDefaultTagName would be ineffective and will result in many duplicates)
            return this.clone();
        }
        const multiTagVersion : MessagePublisher_OperatorPolicy = this.defaultMultitagOperator();
        tags.forEach((t,i) => {
            multiTagVersion.addOperand(this)
            multiTagVersion.operand(i).setDefaultTagName(t)
        });
        return multiTagVersion;
    }

 	/*! Instantiate the default aggregator policy for multi tag versions (AND or OR) */
    abstract defaultMultitagOperator() : MessagePublisher_OperatorPolicy;


    toString() : string {
        return `tag="${this._tagName}"`;
    }

    protected _tagName: string;
};



/*! Is tag value bad or good ? */
export class MessagePublisher_QualityPolicy extends MessagePublisher_TagBasedPolicy
{
    protected _expectGood: boolean;

    constructor( { tagName, expectGood } : { tagName: string, expectGood: boolean }) {
        super(tagName);
        this._expectGood = expectGood;
    }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        if (this._tagName && this._tagName.length != 0 && tagName != this._tagName) {
            // not for me
            return this._nextTime;
        }
        
        this._nextTime = this._expectGood == (newState.quality == Quality.GOOD) ? 0 : INVALID_STATE_TS;
        //RETAILMSG(1, (TEXT("after quality %lld\n"), m_nextTime));
        return this._nextTime;
    }

    toString() {
        return `${(this._expectGood ? "qualitygood:" : "qualitybad:")}${super.toString()}`;
    }

    defaultMultitagOperator() { return this._expectGood ? new MessagePublisher_AndPolicy : new MessagePublisher_OrPolicy }
};

/*! Determine what should be considered as a change */
export enum ChangeMask {
    ValueChange = 0x1, // value is not updated while quality is bad, so if value = 1, then quality bad then again quality good no notification will trigger
    QualityChange = 0x2,
    SourceTimestampChange = 0x4,
    AnyChange = ValueChange | SourceTimestampChange
};

/*! Simple on change policy */
export class MessagePublisher_OnChangedPolicy extends  MessagePublisher_TagBasedPolicy
{

	/*!
	 * \brief MessagePublisher_OnChangedPolicy
	 * \param tagName
	 * \param changeMask : is used to select what to check for changes. by default only the value is used
	 * \param skipFirstNChanges : is used to skip the first nchange, for instance when the machine starts and value is 
	 * first initialized there is a value change which might be skipped, since it is intrinsically generated by 
	 * the gateway protocol when it switches from unconnected to connected state
	 */
    constructor({ tagName = '', changeMask = ChangeMask.ValueChange, skipFirstNChanges = 0, deadband = 0, isPercent = false } : {
        tagName?: string,
        changeMask?: ChangeMask,
        skipFirstNChanges?: number,
        deadband?: number,
        isPercent?: boolean
    }) {
        super(tagName);
        this._lastState = new State;
        this._changeMask = changeMask;
        this._skipFirstNChanges = skipFirstNChanges;
        this._deadband = deadband;
        this._isPercent = isPercent;
    }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        if (this._tagName && this._tagName.length != 0 && tagName != this._tagName) {
            // not for me!
            return this._nextTime;
        }
        
        let triggered = false;
        if (this._changeMask & ChangeMask.ValueChange &&  newState.quality == Quality.GOOD ) {
            if (_.isArray(newState.value)) {
                triggered = 
                    newState.value.length != this._lastState.value.length 
                    || newState.value.reduce( (acc, v, i) => { return triggered || this.isOutOfDeadband(v, this._lastState[i]) }, triggered)
            } else {
                triggered = this.isOutOfDeadband(this._lastState.value, newState.value);
            }
            if (triggered) {
                this._lastState.value = newState.value;
            }
        }
        
        if (this._changeMask & ChangeMask.QualityChange && newState.quality != this._lastState.quality) {
            this._lastState.value = newState.value;
            triggered = true;
        }

        if (this._changeMask & ChangeMask.SourceTimestampChange && newState.timestamp != this._lastState.timestamp) {
            this._lastState.timestamp = newState.timestamp;
            triggered = true;
        }
        
        if (triggered) {		
            if (this._skipFirstNChanges > 0) {
                this._skipFirstNChanges--;
            } else {
                this._nextTime = 0; // immediately send
            }
        }
        
        return this._nextTime;
    }

    toString() : string  {
        return `onchange:${super.toString()}`;
    }
    
	// virtual string toString() const;
	defaultMultitagOperator() { return new MessagePublisher_OrPolicy; }

	
	protected isOutOfDeadband(v1: any, v2: any) : boolean {
        if (!_.isNumber(v1)) {
            return v1 != v2
        }
        let delta = Math.abs(v1 - v2);
        if (!this._isPercent) {
            return delta > this._deadband;
        }
        const threshold = Math.abs(v1 * this._deadband / 100.0)
        return delta > threshold
    }

    protected _lastState : State;
	protected _changeMask: ChangeMask;
	protected _skipFirstNChanges : number;
	protected _deadband : number;
	protected _isPercent : boolean;

    public clone() {
        let cloned = super.clone();
        cloned._lastState = this._lastState.clone();
        return cloned;
    }
};

/*!  0 based absolute timer. Next time depends on current time:
 *
 */
export class MessagePublisher_TimerPolicy extends MessagePublisherPolicy
{
    constructor(interval: number = 1000) {
        super();
        this._interval = interval == 0 ? 1000 : interval
        this._nextTime = 0;
    }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        return this._nextTime;
    }

	/*! Rearm to next valid interval after currentTime */
    public rearm(currentTime: StateTS) : StateTS {
        this._nextTime = (1 + Math.floor(currentTime / this._interval)) * this._interval;
        return this._nextTime;
    }

    toString() {
        return `timer:${this._interval}`
    }

	protected _interval : number;
};

/*! check if tagName is inside or outside a range of values */
export class MessagePublisher_AnalogBandPolicy extends MessagePublisher_TagBasedPolicy
{
	protected _min: number;
	protected _max : number;
	protected _inside : boolean;

    constructor( { tagName, min, max, inside} : { tagName?: string, min?: number, max?: number, inside?: boolean } ) {
        super(tagName);
        this._inside = inside;
        this._min = min;
        this._max = max;
        if (!this._inside) {
            this._nextTime = 0; // first value is undefined and is outside any band
        }
    }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        if (this._tagName && this._tagName.length != 0 && tagName != this._tagName) {
            // not for me
            return this._nextTime;
        }
        this._nextTime = 0; // assume immediately send
        if (_.isArray(newState.value)) {
            for(let v of newState.value) {
                if (!this.isInBand(v)) {
                    this._nextTime = INVALID_STATE_TS;
                    break;
                }
            }
        } else {
            if (!this.isInBand(newState.value)) {
                this._nextTime = INVALID_STATE_TS; // don't send
            }
        }
        return this._nextTime
    }

    toString() {
        return `${this._inside ? "inband:" : "outband:"}${this._min},${this._max},${super.toString()}`;
    }

    defaultMultitagOperator() { return new MessagePublisher_AndPolicy; }


    protected isInBand(v: any) : boolean {
        if (!_.isNumber(v))
            return true;
        if (this._inside)
            return (v >= this._min && v <= this._max);
        return (v < this._min || v > this._max);
    }
};


/*! Special kind of policy for field of a structure (need tagName resolution) */
export class MessagePublisher_OnFieldChangedPolicy extends MessagePublisher_OnChangedPolicy
{
    protected _fieldName: string;

    constructor( {fieldName, changeMask = ChangeMask.ValueChange, skipFirstNChanges = 0, deadband = 0, isPercent = false} : 
        {fieldName: string, changeMask?: ChangeMask, skipFirstNChanges?: number, deadband?: number, isPercent?: boolean} ) {
            super( {tagName: "", changeMask, skipFirstNChanges, deadband, isPercent})
            this._fieldName = fieldName;
    }

    setTagName(tagName: string) {
        this._tagName = tagName;
    }

    get fieldName() { return this._fieldName; }

    setFieldTagName( { fieldName, tagName }  : {fieldName: string, tagName: string}) {
        if (this._fieldName == fieldName) {
            this._tagName = tagName;
        }
    }
}

export enum LevelMode {
    OnEnter = 0x1,
    OnExit = 0x2,
    OnEnterExit = 0x3
};


type LevelType = string | number;
/*! Simple on change policy */
export class MessagePublisher_OnLevelPolicy< LevelType > extends MessagePublisher_TagBasedPolicy
{
    protected  _lastState : State;
	protected  _skipFirstNChanges : number;
	protected _min : number;
	protected _max: number;
    protected _level: LevelType
	protected _mode: LevelMode;

	/*!
	 * \brief MessagePublisher_OnChangedPolicy
	 * \param tagName
	 * \param changeMask : is used to select what to check for changes. by default only the value is used
	 * \param skipFirstNChanges : is used to skip the first nchange, for instance when the machine starts and value is 
	 * first initialized there is a value change which might be skipped, since it is intrinsically generated by 
	 * the gateway protocol when it switches from unconnected to connected state
	 */
    constructor( {tagName,  level, levelMode = LevelMode.OnEnterExit, skipFirstNChanges = 0, deadband = 0, isPercent = false } 
        : { tagName?: string, level?: LevelType, levelMode?: LevelMode, skipFirstNChanges?: number, deadband?: number, isPercent?: boolean}) {
            super(tagName)
            if (typeof level == 'number') {
                this._min = level - (isPercent ? level*deadband/100 : deadband);
                this._max = level + (isPercent ? level*deadband/100 : deadband);
            }
            this._level = level;
            this._mode = levelMode;
            this._skipFirstNChanges = skipFirstNChanges;
            this._lastState = new State;
        }
    
    toString() {
        return `onlevel:${this._level},${super.toString()}`;
    }

    defaultMultitagOperator() { return new MessagePublisher_OrPolicy; }

    public updateState( { tagName, newState, currentTime } : { tagName: string, newState: State, currentTime: StateTS } ) : StateTS {
        if (this._tagName && this._tagName.length != 0 && tagName != this._tagName) {
            // not for me!
            return this._nextTime;
        }
        
        let triggered = false;
        if (newState.value != undefined) {
            let inBand = false;
            let wasInBand = false;
            if (_.isArray(newState.value)) {
                for(let i in newState.value) {
                    inBand = this.isInBand(newState.value[i]);
                    wasInBand = this.isInBand(this._lastState.value[i]);
                    if (inBand != wasInBand) {
                        break;
                    }
                }
            } else {
                inBand = this.isInBand(newState.value);
                wasInBand = this.isInBand(this._lastState.value);
            }
            if (inBand != wasInBand) {
                triggered = (inBand && ( (this._mode & LevelMode.OnEnter)) != 0) || (!inBand && ( (this._mode & LevelMode.OnExit) != 0));
                this._lastState.value = newState;
            }
        }
        
        if (triggered) {		
            if (this._skipFirstNChanges > 0) {
                this._skipFirstNChanges--;
            } else {
                this._nextTime = 0; // immediately send
            }
        }
        
        return this._nextTime;
    };

    protected isInBand(v : LevelType) : boolean  {
        if (typeof v == 'string') {
            return v == this._level
        } else if (typeof v == 'number') {
            return v >= this._min && v <= this._max;
        }
    }

    public clone() {
        let cloned = super.clone();
        cloned._lastState = this._lastState.clone();
        return cloned;
    }

};


/*! Special kind of policy for field of a structure (need tagName resolution) */
class MessagePublisher_FieldLevelPolicy<LevelType> extends MessagePublisher_OnLevelPolicy<LevelType>
{
    protected _fieldName : string;

	constructor( {fieldName, level, levelMode = LevelMode.OnEnterExit, skipFirstNChanges = 0, deadband = 0, isPercent = false} : {
        fieldName?: string, level?: LevelType, levelMode?: LevelMode, skipFirstNChanges?: number, deadband?: number, isPercent?: boolean }
    ) {
        super( {tagName : "", level, levelMode, skipFirstNChanges, deadband, isPercent } );
        this._fieldName = fieldName;
    } 

    setTagName(tagName: string) {
        this._tagName = tagName;
    }

    get fieldName() { return this._fieldName }

    setFieldTagName( { fieldName, tagName } : { fieldName: string, tagName: string}) {
        if (this._fieldName == fieldName) {
            this._tagName = tagName;
        }
    }
};

