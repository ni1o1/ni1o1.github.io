const e=`---
title: "Article Publication | TR part D | Agent-Based Modeling of Resilience and Cascading Failures in Highway Charging Networks"
date: "2026-06-13"
tags:
  - "Electric Vehicle"
  - "Charging Network"
  - "Resilience"
  - "Cascading Failure"
  - "Agent-Based Modeling"
brief: "This study builds a data-driven agent-based simulation of highway charging networks, revealing how a local station outage propagates along corridors into network-wide cascading failures and identifying four typical failure patterns."
show: true
---

## Publication | Transportation Research Part D: Transport and Environment | Agent-Based Modeling of Resilience and Cascading Failures in Highway Charging Networks

**Original Title**: Agent-Based Modeling of Resilience and Cascading Failures in Highway Charging Networks
**Interactive Briefing**: [https://ni1o1.github.io/showcase/ev-resilience/](https://ni1o1.github.io/showcase/ev-resilience/)
**Original Link**: [https://doi.org/10.1016/j.trd.2026.105478](https://doi.org/10.1016/j.trd.2026.105478)

![title](../posts/images/ev-resilience-header.jpg)

### Abstract

As electric vehicle penetration rises rapidly, the reliability of highway charging networks is becoming a key bottleneck for electrified intercity travel. Static coverage metrics can tell us how many chargers were built, but not when, where, and which station fails first. This study proposes a data-driven agent-based modeling (ABM) framework: intercity travel demand (~0.96 million vehicles/day across 129 ramps) is inversely estimated from observed traffic on the Yangtze River Delta highway network, and each EV agent autonomously decides where to charge, whether to queue, and whether to abandon charging — reproducing the dynamic evolution of the charging network under failure stress at vehicle-and-plug granularity.

### Highlights

• A data-driven ABM framework for highway charging network resilience, covering network reconstruction, OD estimation, and individual charging behavior
• Failure stress propagates by "leaping" along corridors: a single station outage breeds secondary failure hubs 80–160 km away
• A "high capacity, low resilience" paradox in the morning peak: the highest static capacity limit, yet the first to collapse in service quality (QoS saturation at ρ = 3.8%)
• Station-by-station incremental failure experiments identify four failure patterns: Hyper-Sensitive Adaptive, Oversaturated Bypass, Graceful Degradation, and Robust-but-Brittle

### Key Findings

1. **Cascading failures leap along corridors instead of spreading locally**: Station 35 lost only one charging plug, yet drivers abandoned its long queue and drove downstream with dwindling batteries, eventually crowding into Stations 61 and 37 — about 80 km and 160 km away — which became secondary failure hubs hit as hard as the failure source. Meanwhile Station 24, immediately downstream, saw shorter queues than usual because upstream congestion "intercepted" its arrivals — a local improvement that does not compensate for the network-wide loss.
![title](../posts/images/ev-resilience-cascading.webp)

2. **The high-capacity morning peak collapses first**: Sweeping EV penetration ρ from 1% to 33.8%, the morning peak has the highest equilibrium-point capacity limit (ρ = 32.0%), but its service backlog starts deteriorating systematically at ρ = 3.8% — the cold-start surge load wipes out the system's recovery margin.
![title](../posts/images/ev-resilience-network.webp)

3. **72 stations fail in only four ways**: Incremental failure experiments on every station under a high-stress scenario (ρ = 20%) cluster the failure curves into four patterns. In two of them (Hyper-Sensitive Adaptive and Oversaturated Bypass), the apparent "recovery" of metrics is an illusion created by driving customers away — abandonment rates exceed 75% and tail waiting times remain above 32,000 seconds; only Graceful Degradation, supported by network redundancy, represents genuine degradation.
![title](../posts/images/ev-resilience-patterns.webp)

### Conclusion

The study shows that the resilience weakness of highway charging networks lies not in the number of chargers but in the network propagation structure of failure stress and time-of-day load characteristics. Planning and operations should focus on potential secondary failure hubs downstream along corridors, reserve recovery margins for morning-peak cold-start loads, and allocate redundancy according to each station's failure pattern type rather than its size alone. The paper has been published in Transportation Research Part D — visit the [interactive briefing](https://ni1o1.github.io/showcase/ev-resilience/) to replay the cascading failure on the map.
`;export{e as default};
