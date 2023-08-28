interface BatchConfig {
  transition: number | null
}

// shared data among different files
const ReactCurrentBatchConfig: BatchConfig = {
  transition: null, // whether in shared state
}

export default ReactCurrentBatchConfig
