# Corvina simulated device example

## Quick Start

```shell
yarn install

ACTIVATION_KEY=.... PAIRING_ENDPOINT=https://pairing.corvina.io/api/v1/ yarn start:dev
```

A web interface will be available at `http://localhost:3000/`.

## Setup configuration environment

The virtual device can be configured passing environment variables inline or in file `.env`

The last configuration is saved in `.env` after lines:

```
### LAST-ENV ###
# don't write below this line!!
```

## Configuration variables description

| | |
| - | - |
| **ACTIVATION_KEY** | The device activation key | 
| **PAIRING_ENDPOINT** | The pairing endpoint used by the device to contact corvina server for communicdation |
| **AVAILABLE_TAGS** | The set of tags (variables) advertised by the device to the cloud. It is a JSON list or object: `{ "name": "string", "type": "integer|double|string|boolean" , "simulation" : { simulation_config }}`. Below the simulation configuration format is described |
| **AVAILABLE_TAGS_FILE** | The filename the list of available tags should be read from  |
| **SIMULATE_TAGS** | 0 or 1 to disable/enable tag simulation  |
| **SIMULATION_MS** | The simulation step in ms  |
| **AVAILABLE_ALARMS** | The JSON formatted list of alarms that can be triggered. The alarm description format is `{"name":"string","severity":1,"source":"string","desc":{"en":"Description with live tags [Tag1]"},"ack_required":true,"reset_required":true,"simulation":{ simulation_function_config}}` |
| **PACKET_FORMAT** | The payload format (either 'bson' or 'json')  |
| **SIMULATE_TAGS** | 0 or 1 to disable/enable tag simulation  |
| **LOG_LEVEL** | Verbosity of logs : error, warning, info, debug |
| **PORT** | The port the http server will listen for commands|
|  |  |

### Simulation configuration

There are several simulation types:

| | |
| - | - |
| **const :** `"type":  "const", "value": number\|string ` | constant value with optional additional noise | 
| **step :**`"type": "step", "amplitude": number, "offset": number,  "easing": string,  "easingProps" ?: { d3-ease props }, "jump_probability": number, "dt_min": number, "dt_max": number` | Stepwise function which jumps to different values with a given probability and using a specified easing curve to reach the new target value after the jump. `amplitude` is the maximum amplitude of random jump. `offset` is an initial offset. `easing` is a type of easing function as provided by [d3-ease](https://github.com/d3/d3-ease) package   and `easingProps` are the related configuration properties. `jump_probability` is a number between 0 and 1 such that if =1 no jumps/steps are performed at all, if 0 a jump is done right after a new target value is reached, =0.1 jumps every 10sec on average etc. `dt_min` and `dt_max` are used to select the transition time from one value to a new target value | 
| **sine :** `"type":  "sine" , "amplitude": number, "offset": number, "period": number, "phase": number `| sine function | 
| **function :** `"type": "function", "f" : "function javascript code"` | custom javascript function. The additional operator `$('tagname')` can be used to access the simulated value of other tags  | 
|  |  |

Additional noise can be cascaded to any simulation type. The noise can be absolute or percentual:

| | |
| - | - |
| `"noise":  "abs", "amplitude" : number` | absolute noise of given amplitude | 
| `"noise":  "%", "amplitude" : number` | percentual noise of given amplitude | 
| | |

In addition simulation values can be nullified with a given probability for a given random configurable time range

```json
{ "nullable":  { "probability": [0..1], "dt_min" : ms, "dt_max": ms }

```

#### Simulating atomic structures
Atomic structures can be simulated by simulating individual properties using the naming conventions: `struct_name.property_name`.

For instance, the following code:

```
AVAILABLE_TAGS=[{"name":"struct.Tag1","type":"integer"},{"name":"struct.Tag2","type":"integer"}]
```

 will simulate sending both `struct` as a whole, and `struct.Tag1` and `struct.Tag2` as single properties.

In particular, the whole simulated structure can be attached to a Corvina structure only if the set of properties matches (same names, case sensitive).

### Using the example rest interface

It is possible to send generic JSON posting to the `/device/json` endpoint.

Each of the JSON properties posted will be advertised to the cloud with the corresponding JSON paths.