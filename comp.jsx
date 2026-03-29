import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>QR Code + Counter</h1>
      <QRCodeSVG value="https://reactjs.org/" size={256}i includeMargin={true} />
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => setCount((count) => count + 1)}>
          Count is {count}
        </button>
      </div>
    </div>
  );
}

export default App;

