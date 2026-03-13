console.log("Mock Plugin Script Injected successfully!");

const btn = document.createElement("button");
btn.className = "injected-btn";
btn.innerText = "I am a Plugin Button!";
btn.onclick = () => alert("Plugin JS trigger!");

document.body.appendChild(btn);