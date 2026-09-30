// Promise-state helper: tracks a promise's pending/data/error state for views.

export function resolvePromise(prms, promiseState) {
  promiseState.promise = prms
  promiseState.data = null
  promiseState.error = null

  if (prms != null) prms.then(setDataACB).catch(errorACB)

  function setDataACB(param) {
    if (promiseState.promise == prms) promiseState.data = param
  }

  function errorACB(param) {
    if (promiseState.promise == prms) promiseState.error = param
  }
}
