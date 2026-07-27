import openaiIcon from '@lobehub/icons-static-svg/icons/openai.svg'
import Fable5Page from './Fable5Page.jsx'

export default function Gpt56Page({ onBack }) {
  return (
    <Fable5Page
      onBack={onBack}
      dataBase="/gpt5-6-data"
      dataLabel="gpt5-6"
      title="GPT 5.6"
      iconSrc={openaiIcon}
      analyticsPrefix="gpt56"
      enableFavorites={false}
      visualMode
      accentColor="#74f8d4"
    />
  )
}
