class NoiseGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.thresholdDb = -45;
    this.reduction = 0.65;
    this.envelope = 0;
    this.gateGain = 1;
    this.port.onmessage = ({ data }) => {
      if (typeof data.thresholdDb === 'number') this.thresholdDb = data.thresholdDb;
      if (typeof data.reduction === 'number') this.reduction = Math.max(0, Math.min(1, data.reduction));
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input.length) return true;
    const threshold = Math.pow(10, this.thresholdDb / 20);
    const floor = Math.pow(10, (-42 * this.reduction) / 20);
    const attack = Math.exp(-1 / (sampleRate * 0.008));
    const release = Math.exp(-1 / (sampleRate * 0.22));
    const gainAttack = Math.exp(-1 / (sampleRate * 0.012));
    const gainRelease = Math.exp(-1 / (sampleRate * 0.13));

    for (let i = 0; i < output[0].length; i++) {
      let peak = 0;
      for (const channel of input) peak = Math.max(peak, Math.abs(channel[i] || 0));
      const envelopeSpeed = peak > this.envelope ? attack : release;
      this.envelope = envelopeSpeed * this.envelope + (1 - envelopeSpeed) * peak;
      // A soft knee avoids an abrupt cut at the threshold.
      const ratio = this.envelope / Math.max(threshold, 1e-7);
      const open = Math.max(0, Math.min(1, (ratio - 0.55) / 0.9));
      const smooth = open * open * (3 - 2 * open);
      const target = floor + (1 - floor) * smooth;
      const speed = target > this.gateGain ? gainAttack : gainRelease;
      this.gateGain = speed * this.gateGain + (1 - speed) * target;
      for (let c = 0; c < output.length; c++) output[c][i] = (input[c]?.[i] || 0) * this.gateGain;
    }
    return true;
  }
}

registerProcessor('noise-gate', NoiseGateProcessor);
