import { MessagePublisherPolicy, State, StateTS  } from "./messagepublisherpolicies";

interface MessageSender {
	sendMessage(ts: number, payload : Object);
}

function castType(value: any, topicType: string) {
	switch(topicType) {
	case 'integer':
		return ~~value;
	case 'boolean':
		if (typeof value == 'string') {
			if (value == 'true') {
				return true;
			} else if (value == 'false') {
				return false;
			} else {
				return !!~~value;
			}
		}
		return !!value;
	case 'string':
		return "" + value
	case 'double':
		return parseFloat(value)
	case 'struct':
		break;
	default:
		throw 'Unsupported data type ' + topicType
	}
	return value;
}

/*! Publish data according to new data and installed policies */
export class MessagePublisher 
{
	protected _topic: string;
	protected _topicType: string;
    protected _tagName: string;
    protected _nextTime: StateTS;
    protected _policy: MessagePublisherPolicy;
    protected _armed: boolean;
    protected _stateToPublish: State;

	protected _lastStateVersion = 0
	protected _lastPublishedStateVersion = 0;
	private _messageSender : MessageSender;

    constructor({sourceTag, topic, topicType} : {sourceTag: string, topic: string, topicType: string} ) {
		this._tagName = sourceTag;
		this._topic = topic;
		this._topicType = topicType;
        this._tagName = sourceTag;
        this._nextTime = -1;
        this._policy = null;
        this._armed = false;
		this._stateToPublish = new State;
    }

	get policy() : MessagePublisherPolicy {
		return this._policy;
	}

    setPolicy(policy: MessagePublisherPolicy) {
		this._policy = policy.clone();
	}

	/*! Next publish event will occur in specified number of ms */
	update( {tagName, newState, currentTime} : { tagName: string, newState: State, currentTime: StateTS } ): StateTS {
		if (tagName == this._tagName) {
			this._stateToPublish.timestamp = newState.timestamp;
			this._stateToPublish.value = castType(newState.value, this._topicType);
		}
		if (this._policy) {
			this._nextTime = this._policy.updateState( {tagName, newState, currentTime} );
		} else {
			this._nextTime = -1; // by default don't publish
		}
		return this._nextTime;
	} 

	rearm(currentTime : StateTS) : StateTS {
		if (this._policy) {
			this._nextTime = this._policy.rearm(currentTime);
		} else {
			this._nextTime = -1; // by default don't publish
		}
		this._armed = true;
		return this._nextTime;
	}

	nextTime(currentTime : StateTS) : StateTS {
		if (!this._armed) {
			return this.rearm(currentTime);
		}
		return this._nextTime;
	}

	/* Derived class must reimplement this function to actually publish value */
	publish(currentTime : StateTS, messageSender: MessageSender) {
		let ts = this._lastPublishedStateVersion == this._lastStateVersion ? Date.now() : this._stateToPublish.timestamp;

		messageSender.sendMessage(ts, this._stateToPublish.value);

		this._lastPublishedStateVersion = this._lastStateVersion;
		this.rearm(currentTime);
	}

	toString() : string {
		return `MessagePublisher@${this._tagName} => ${this._topic} ( ${this._policy ? this._policy.toString() : "NULL"})`;	
	}
}


/** Publish atomic structures */
export class AggregatedMessagePublisher extends MessagePublisher
{
	private _recomputePolicy = false;

	constructor( {sourceTag, topic} : { sourceTag: string, topic: string } ) {
		super({sourceTag, topic, topicType: "struct"})
	}

	addField( {tagName, fieldName, type } : {tagName: string, fieldName: string, type: string }) {
		this._fields.push( {tagName, fieldName, type, lastValueToPublish: undefined } )
		this._recomputePolicy = true
	}

	update( {tagName, newState, currentTime} : { tagName: string, newState: State, currentTime: StateTS } ): StateTS {
		if (this._recomputePolicy) {
			this._fields.forEach((f) => {
				if (f.tagName == tagName) {
					f.lastValueToPublish = castType(newState.value, f.type);
				}
				this._policy.setFieldTagName( {fieldName: f.fieldName, tagName: f.tagName} )
			});
			this._policy = this._policy.multiTagVersion(this._fields.map((f) => f.tagName));
		}	
		return super.update({tagName, newState, currentTime});
	}

	publish(currentTime : StateTS, messageSender: MessageSender) {
		let ts = this._lastPublishedStateVersion == this._lastStateVersion ? Date.now() : this._stateToPublish.timestamp;

		let x = {}
		this._fields.forEach((f) => { x[f.fieldName] = f.lastValueToPublish })

		messageSender.sendMessage(ts, x);

		this._lastPublishedStateVersion = this._lastStateVersion;
		this.rearm(currentTime);
	}


	toString() : string {
		return `AggregatedMessagePublisher@${this._tagName} => ${this._topic} ( ${this._policy ? this._policy.toString() : "NULL"})`;	
	}

	protected _fields : { tagName, fieldName, type, lastValueToPublish }[];
}
