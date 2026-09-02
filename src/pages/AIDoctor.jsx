import { useState, useRef } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { Camera, Mic, Send, Volume2, Bot, User, Sparkles, Stethoscope } from 'lucide-react';
import { askAgricultureAI } from '../data/mockData';
import './AIDoctor.css';

const suggestedQuestions = {
  en: ['Why is my crop growth slow?', 'Should I irrigate today?', 'What fertilizer should I use?'],
  bn: ['আমার ফসলের বৃদ্ধি কেন ধীর?', 'আজ আমি কি সেচ দেব?', 'কোন সার ব্যবহার করব?'],
  hi: ['मेरी फसल की वृद्धि धीमी क्यों है?', 'मुझे आज सिंचाई करनी चाहिए?', 'कौन सी खाद इस्तेमाल करूं?'],
  te: ['నా పంట పెరుగుదల ఎందుకు నెమ్మదిగా ఉంది?', 'ఈ రోజు నేను నీరు పోయాలా?', 'ఏ ఎరువు వాడాలి?'],
  ta: ['என் பயிர் வளர்ச்சி ஏன் தாமதமாக உள்ளது?', 'இன்று நீர்ப்பாசனம் செய்ய வேண்டுமா?', 'எந்த உரத்தை பயன்படுத்த வேண்டும்?'],
};

const mockDiagnosis = {
  problem: 'Rice Leaf Blast', confidence: 91, severity: 'Moderate',
  actions: ['Inspect nearby plants for similar symptoms', 'Maintain proper field drainage and spacing', 'Apply recommended fungicide treatment', 'Recheck affected area after 3 days'],
};

export default function AIDoctor() {
  const { t, language } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date() }]);
    setInput('');
    setLoading(true);
    const response = await askAgricultureAI(text, 'default');
    setMessages(prev => [...prev, { role: 'assistant', content: response.answer, confidence: response.confidence, timestamp: new Date() }]);
    setLoading(false);
    setTimeout(scrollToBottom, 100);
  };

  const handleVoice = () => {
    setListening(!listening);
    if (!listening) {
      setTimeout(() => { setListening(false); sendMessage('আমার ধানের পাতাগুলো হলুদ হয়ে যাচ্ছে'); }, 3000);
    }
  };

  const handlePhoto = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setMessages(prev => [...prev, { role: 'assistant', isDiagnosis: true, diagnosis: mockDiagnosis, timestamp: new Date() }]);
      setTimeout(scrollToBottom, 100);
    }, 2500);
  };

  return (
    <div className="page-container ai-doctor">
      <section className="ai-doctor__header section">
        <h1 className="ai-doctor__title">{t('ai.askKrisiveda')}</h1>
        <p className="ai-doctor__subtitle">{t('ai.askAnything')}</p>
      </section>

      {messages.length === 0 && !scanning ? (
        <section className="ai-doctor__hero">
          <div className="ai-doctor__hero-icon"><Stethoscope size={48} /></div>
          <h2 className="ai-doctor__hero-title">{t('ai.askKrisiveda')}</h2>
          <p className="ai-doctor__hero-subtitle">{t('ai.askAnything')}</p>
          <div className="ai-doctor__actions">
            <button className="ai-doctor__action-btn" onClick={handlePhoto}><Camera size={22} /><span>{t('ai.takePhoto')}</span></button>
            <button className="ai-doctor__action-btn ai-doctor__action-btn--voice" onClick={handleVoice}><Mic size={22} /><span>{t('ai.askByVoice')}</span></button>
          </div>
          <div className="ai-doctor__suggested">
              <span className="ai-doctor__suggested-label">{t('ai.suggestedQuestions')}</span>
              <div className="ai-doctor__suggested-list">
                {(suggestedQuestions[language] || suggestedQuestions.en).map((q, i) => (
                  <button key={i} className="ai-doctor__suggested-btn" onClick={() => sendMessage(q)}><Sparkles size={14} />{q}</button>
                ))}
              </div>
            </div>
        </section>
      ) : (
        <div className="ai-doctor__chat">
          <div className="ai-doctor__messages">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-doctor__message ai-doctor__message--${msg.role}`}>
                <div className={`ai-doctor__message-avatar ${msg.role === 'assistant' ? 'ai-doctor__message-avatar--ai' : ''}`}>
                  {msg.role === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                </div>
                <div className="ai-doctor__message-content">
                  {msg.isDiagnosis ? (
                    <div className="ai-doctor__diagnosis">
                      <div className="ai-doctor__diagnosis-header"><Stethoscope size={18} /><span>{t('ai.possibleProblem')}: {msg.diagnosis.problem}</span></div>
                      <div className="ai-doctor__diagnosis-meta">
                        <span>{t('ai.confidence')}: {msg.diagnosis.confidence}%</span>
                        <span>{t('ai.severity')}: {msg.diagnosis.severity}</span>
                      </div>
                      <div className="ai-doctor__diagnosis-actions">
                        <strong>{t('ai.whatToDo')}:</strong>
                        <ol>{msg.diagnosis.actions.map((a, j) => <li key={j}>{a}</li>)}</ol>
                      </div>
                      <button className="ai-doctor__listen-btn"><Volume2 size={14} /> {t('ai.listen')}</button>
                    </div>
                  ) : (
                    <>
                      <p>{msg.content}</p>
                      {msg.confidence && <span className="ai-doctor__confidence">{t('ai.confidence')}: {msg.confidence}%</span>}
                    </>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-doctor__message ai-doctor__message--assistant">
                <div className="ai-doctor__message-avatar ai-doctor__message-avatar--ai"><Bot size={18} /></div>
                <div className="ai-doctor__message-content"><div className="ai-doctor__typing"><span /><span /><span /></div></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="ai-doctor__input-area">
            {listening && <div className="ai-doctor__listening"><div className="ai-doctor__listening-pulse" /><span>{t('ai.listening')}</span></div>}
            {scanning && <div className="ai-doctor__scanning"><div className="ai-doctor__scanning-animation" /><span>Analyzing crop image...</span></div>}
            <div className="ai-doctor__input-row">
              <button className="ai-doctor__input-action" onClick={handlePhoto} title={t('ai.takePhoto')}><Camera size={18} /></button>
              <button className={`ai-doctor__input-action ${listening ? 'ai-doctor__input-action--active' : ''}`} onClick={handleVoice} title={t('ai.askByVoice')}><Mic size={18} /></button>
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)} placeholder={t('ai.typeQuestion')} className="ai-doctor__input" />
              <button className="ai-doctor__send" onClick={() => sendMessage(input)} disabled={!input.trim()}><Send size={18} /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
