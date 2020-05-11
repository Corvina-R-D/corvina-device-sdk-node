import { assert, expect } from "chai";
import {
    ChangeMask,
    INVALID_STATE_TS,
    MessagePublisher_AnalogBandPolicy,
    MessagePublisher_AndPolicy,
    MessagePublisher_OnChangedPolicy,
    MessagePublisher_OnFieldChangedPolicy,
    MessagePublisher_OnLevelPolicy,
    MessagePublisher_OrPolicy,
    MessagePublisher_QualityPolicy,
    MessagePublisher_TimerPolicy,
    State,
} from "./messagepublisherpolicies";

describe("Test policies", () => {
    const timerInterval = 2000;
    const onChange = new MessagePublisher_OnChangedPolicy({
        tagName: "tagX",
        changeMask: ChangeMask.ValueChange,
    });
    const timer = new MessagePublisher_TimerPolicy(timerInterval);
    const inBand = new MessagePublisher_AnalogBandPolicy({
        tagName: "tagX",
        min: 0,
        max: 100,
        inside: true,
    });
    const outBand = new MessagePublisher_AnalogBandPolicy({
        tagName: "tagX",
        min: 0,
        max: 100,
        inside: false,
    });
    const qualityGood = new MessagePublisher_QualityPolicy({
        tagName: "tagX",
        expectGood: true,
    });
    const qualityBad = new MessagePublisher_QualityPolicy({
        tagName: "tagX",
        expectGood: false,
    });

    const _and = new MessagePublisher_AndPolicy([onChange, timer]);

    const band1 = new MessagePublisher_AnalogBandPolicy({
        tagName: "tagX",
        min: 0,
        max: 100,
        inside: true,
    });
    const band2 = new MessagePublisher_AnalogBandPolicy({
        tagName: "tagY",
        min: 200,
        max: 300,
        inside: true,
    });
    const band3 = new MessagePublisher_AnalogBandPolicy({
        tagName: "tagZ",
        min: 400,
        max: 500,
        inside: true,
    });
    const band4 = new MessagePublisher_AnalogBandPolicy({
        tagName: "tagT",
        min: 600,
        max: 700,
        inside: true,
    });
    const _or = new MessagePublisher_OrPolicy([band1, band2, band3, band4]);

    it("Quality policies: ", () => {
        let t = qualityGood.rearm(0);
        expect(t).equals(INVALID_STATE_TS); // no change
        t = qualityBad.rearm(0);
        expect(t).equals(INVALID_STATE_TS); // no change

        const s = new State();
        s.value = 1;
        t = qualityGood.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(0);
        t = qualityBad.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(INVALID_STATE_TS);

        s.value = undefined;
        t = qualityGood.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 200,
        });
        expect(t).equals(INVALID_STATE_TS);
        t = qualityBad.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 200,
        });
        expect(t).equals(0);

        s.value = 1;
        t = qualityGood.updateState({
            tagName: "tagY",
            newState: s,
            currentTime: 300,
        });
        expect(t).equals(INVALID_STATE_TS);
        t = qualityBad.updateState({
            tagName: "tagY",
            newState: s,
            currentTime: 300,
        });
        expect(t).equals(0);

        t = qualityGood.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 400,
        });
        expect(t).equals(0);
        t = qualityBad.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 400,
        });
        expect(t).equals(INVALID_STATE_TS);
    });

    it("Test band", () => {
        let t = inBand.rearm(0);
        expect(t).equals(INVALID_STATE_TS);
        t = outBand.rearm(0);
        expect(t).equals(INVALID_STATE_TS);

        const s = new State();
        s.value = 0;
        t = inBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(0);
        t = outBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(INVALID_STATE_TS);

        s.value = 100;
        t = inBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(0);
        t = outBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(INVALID_STATE_TS);

        s.value = -1;
        t = inBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(INVALID_STATE_TS);
        t = outBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(0);

        s.value = 101;
        t = inBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(INVALID_STATE_TS);
        t = outBand.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(0);
    });

    it("Test onchange", () => {
        let t = onChange.rearm(0);
        expect(t).equals(INVALID_STATE_TS);

        const s = new State();
        s.value = 1;
        t = onChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(0);
        t = onChange.rearm(110);
        expect(t).equals(INVALID_STATE_TS);
    });

    it("Test ontimer", () => {
        let t = timer.rearm(timerInterval * 10);
        expect(t).equals(timerInterval * 11);
        t = timer.rearm(timerInterval * 11 + timerInterval / 2);
        expect(t).equals(timerInterval * 12);
    });

    it("Test and", () => {
        let t = _and.rearm(0);
        expect(t).equals(INVALID_STATE_TS);

        // change state
        const s = new State();
        s.value = 2;
        t = _and.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(timerInterval);

        // poll at 2000
        t = _and.rearm(2010);
        expect(t).equals(INVALID_STATE_TS);
        s.value = 0;
        t = _and.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 2800,
        });
        expect(t).equals(2 * timerInterval);

        t = timer.rearm(timerInterval * 11 + timerInterval / 2);
        expect(t).equals(timerInterval * 12);
    });

    it("Test or", () => {
        let t = _or.rearm(0);
        expect(t).equals(INVALID_STATE_TS);

        const s = new State();
        s.value = 1;
        t = _or.updateState({ tagName: "tagX", newState: s, currentTime: 100 });
        expect(t).equals(0);

        s.value = -1;
        t = _or.updateState({ tagName: "tagX", newState: s, currentTime: 100 });
        expect(t).equals(INVALID_STATE_TS);

        s.value = 210;
        t = _or.updateState({ tagName: "tagX", newState: s, currentTime: 100 });
        expect(t).equals(INVALID_STATE_TS);
        t = _or.updateState({ tagName: "tagY", newState: s, currentTime: 100 });
        expect(t).equals(0);
        s.value = -310;
        t = _or.updateState({ tagName: "tagY", newState: s, currentTime: 100 });
        expect(t).equals(INVALID_STATE_TS);

        s.value = 410;
        t = _or.updateState({ tagName: "tagZ", newState: s, currentTime: 100 });
        expect(t).equals(0);
        s.value = -510;
        t = _or.updateState({ tagName: "tagZ", newState: s, currentTime: 100 });
        expect(t).equals(INVALID_STATE_TS);

        s.value = 610;
        t = _or.updateState({ tagName: "tagT", newState: s, currentTime: 100 });
        expect(t).equals(0);
        s.value = -710;
        t = _or.updateState({ tagName: "tagT", newState: s, currentTime: 100 });
        expect(t).equals(INVALID_STATE_TS);
    });

    it("Skipping first update from quality bad to quality good", () => {
        let onValueChange = new MessagePublisher_OnChangedPolicy({
            tagName: "tagX",
            changeMask: ChangeMask.ValueChange | ChangeMask.QualityChange,
            skipFirstNChanges: 1,
        });
        let t = onValueChange.rearm(0);
        expect(t).equals(INVALID_STATE_TS);

        // usually first update in with communicatino error, is configured to be skipped
        const s = new State();
        s.value = undefined;

        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(INVALID_STATE_TS);

        // then second update is with actual value, and is configured to be skipped
        s.value = 0;
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 110,
        });
        expect(t).equals(INVALID_STATE_TS);

        // finally third update is with actual value, and is published
        s.value = 1;
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 120,
        });
        expect(t).equals(0);

        onValueChange = new MessagePublisher_OnChangedPolicy({
            tagName: "tagX",
            changeMask: ChangeMask.ValueChange | ChangeMask.QualityChange,
            skipFirstNChanges: 0,
        });
        s.value = undefined;
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 100,
        });
        expect(t).equals(INVALID_STATE_TS);
        s.value = 0;
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 110,
        });
        expect(t).equals(0);
        s.value = 1;
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 120,
        });
        expect(t).equals(0);
    });

    it("Clone test", () => {
        const p1 = new MessagePublisher_OnFieldChangedPolicy({ fieldName: "" });
        const p2 = new MessagePublisher_OnLevelPolicy({
            tagName: "",
            level: 1,
        });
        const a = new MessagePublisher_AndPolicy([p1, p2]);
        const cloned = a.clone();
        expect(a.operand(0)).equals(p1);
        expect(a.operand(1)).equals(p2);
        expect(cloned.operand(0)).not.equals(p1);
        expect(cloned.operand(1)).not.equals(p2);
    });

    it("Test absolute dead band", () => {
        const onValueChange = new MessagePublisher_OnChangedPolicy({
            tagName: "tagX",
            changeMask: ChangeMask.ValueChange,
            skipFirstNChanges: 0,
            deadband: 10,
            isPercent: false,
        });
        let t = onValueChange.rearm(0);
        expect(t).equals(INVALID_STATE_TS);

        const s = new State();
        s.value = 10;

        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 1,
        });
        expect(t).equals(0);

        // in dead band
        s.value = 19;
        t = onValueChange.rearm(110);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 110,
        });
        expect(t).equals(INVALID_STATE_TS);

        // in dead band
        s.value = 1;
        t = onValueChange.rearm(110);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 120,
        });
        expect(t).equals(INVALID_STATE_TS);

        // outside dead band
        s.value = 20 + 0.01;
        t = onValueChange.rearm(120);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 130,
        });
        expect(t).equals(0);

        // outside dead band
        s.value = 10;
        t = onValueChange.rearm(140);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 140,
        });
        expect(t).equals(0);
    });

    it("Test percentual dead band", () => {
        const deadBandPercent = 10;
        const initialValue = 10;
        const onValueChange = new MessagePublisher_OnChangedPolicy({
            tagName: "tagX",
            changeMask: ChangeMask.ValueChange,
            skipFirstNChanges: 0,
            deadband: deadBandPercent,
            isPercent: true,
        });

        let t = onValueChange.rearm(0);
        expect(t).equals(INVALID_STATE_TS);

        const s = new State();
        s.value = initialValue;

        // initial value
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 1,
        });
        expect(t).equals(0);

        // in dead band
        s.value = initialValue + (initialValue * (deadBandPercent - 1)) / 100;
        t = onValueChange.rearm(110);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 110,
        });
        expect(t).equals(INVALID_STATE_TS);

        // in dead band
        s.value = initialValue - (initialValue * (deadBandPercent - 1)) / 100;
        t = onValueChange.rearm(120);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 120,
        });
        expect(t).equals(INVALID_STATE_TS);

        // outside dead band
        s.value = initialValue + (initialValue * deadBandPercent) / 100 + 0.01;
        t = onValueChange.rearm(130);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 130,
        });
        expect(t).equals(0);

        // outside dead band
        s.value = initialValue - (initialValue * deadBandPercent) / 100;
        t = onValueChange.rearm(140);
        t = onValueChange.updateState({
            tagName: "tagX",
            newState: s,
            currentTime: 140,
        });
        expect(t).equals(0);
    });
});
