import { SimulationEngine } from './engine'
import type { Scenario } from './engine'
class SimulationRuntime {
  engine = new SimulationEngine()
  enabled = false
  private version = 0
  private lastWall = 0
  private listeners = new Set<() => void>()
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getVersion = () => this.version
  private notify() {
    this.version++
    for (const listener of this.listeners) listener()
  }
  // Bound background-tab catch-up to 10 wall-clock seconds per pulse.
  pulse = (now: number) => {
    const elapsed = Math.max(0, Math.min(now - this.lastWall, 10000))
    this.lastWall = now
    if (this.enabled && this.engine.getInfo().running) {
      this.engine.advance(elapsed)
      this.notify()
    }
  }
  start = () => {
    this.lastWall = performance.now()
    this.enabled = true
    this.engine.start()
    this.notify()
  }
  pause = () => {
    this.pulse(performance.now())
    this.engine.pause()
    this.notify()
  }
  resume = () => {
    this.lastWall = performance.now()
    this.enabled = true
    this.engine.resume()
    this.notify()
  }
  reset = () => {
    this.lastWall = performance.now()
    this.enabled = true
    this.engine.reset()
    this.notify()
  }
  setScenario = (s: Scenario) => {
    this.pulse(performance.now())
    this.engine.setScenario(s)
    this.notify()
  }
  setSpeed = (speed: number) => {
    this.pulse(performance.now())
    this.engine.setSpeed(speed)
    this.notify()
  }
  prePaw = () => {
    this.pulse(performance.now())
    this.engine.createPrePawSession()
    this.notify()
  }
}
export const simulationRuntime = new SimulationRuntime()
