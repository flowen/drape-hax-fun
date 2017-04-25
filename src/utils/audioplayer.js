import audioPlayer from 'web-audio-player';
import createAnalyser from 'web-audio-analyser';
import average from 'analyser-frequency-average';
import createAudioContext from 'ios-safe-audio-context';
import {mp3Sources as sources} from './sources'

var loading = document.querySelector('.loading');
var audioContext = createAudioContext();
var player = audioPlayer(sources, {
  context: audioContext,
  buffer: true,
  loop: true
});

// This is triggered on mobile, when decodeAudioData begins.
player.once('decoding', (amount) => loading.innerText = 'Decoding...')

// Only gets called when loop: false
player.on('end', () => console.log('Audio ended') )

// If there was an error loading the audio
player.on('error', (err) =>  {
  console.error(err.message)
  loading.innerText = 'Error loading audio.'
});

// This is called with 'canplay' on desktop, and after
// decodeAudioData on mobile.
player.on('load', () => {
  loading.style.display = 'none'

  console.log('Source:', player.element ? 'MediaElement' : 'Buffer')
  console.log('Playing', Math.round(player.duration) + 's of audio...')

  // start audio node
  player.play()
});

export default player;