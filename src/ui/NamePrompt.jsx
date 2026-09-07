// src/ui/NamePrompt.jsx — the inline "type a name" form the cards use where the old single-file page used
// window.prompt(): naming and renaming a crew (CrewCard) and Change name (AccountCard). A prompt blocks
// the page, cannot be styled, cannot be driven by a test, and on iOS in standalone mode is easy to miss
// altogether. The one prompt left in the app is the password confirmation in cloud/auth.js, which is
// inside the Firebase layer and documented there.
//
// `initial` is what the field starts with and `placeholder` is the greyed-out suggestion: an example crew
// name belongs in the second, or "Save" without typing would name the crew after the example.
import {useEffect, useRef, useState} from 'react';

export default function NamePrompt({label, initial = '', placeholder, maxLength = 60, onSave, onCancel}){
  const [value, setValue] = useState(initial);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <form className="authform nameform" onSubmit={ev => { ev.preventDefault(); onSave(value); }}>
      <input ref={ref} type="text" name="newname" maxLength={maxLength} aria-label={label} placeholder={placeholder || label} value={value} onChange={ev => setValue(ev.target.value)} />
      <div className="actions">
        <button type="submit" className="btn primary">Save</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
