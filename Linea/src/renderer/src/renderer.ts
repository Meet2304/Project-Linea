const appEl = document.getElementById('app')
const button = document.createElement('button')
button.textContent = 'Toggle click-through'
appEl?.appendChild(button)

button.addEventListener('click', async () => {
  const isClickThrough = await window.linea.toggleClickThrough()
  button.textContent = isClickThrough ? 'Click-through ON' : 'Toggle click-through'
})
