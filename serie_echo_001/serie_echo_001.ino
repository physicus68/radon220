String message = "";

unsigned long mesure = 0UL;
bool LED = true;

// modélisation décroissance radioactive radon220


unsigned long dt = 7100;  // ms interval de mesure
float t_1_2 = 56.4;       // ms interval de mesure

unsigned int N0 = 1000;  // population initiale
unsigned int N_i = N0;
unsigned int N_i_1 = 0;
unsigned long t_0 = 0;

// K = exp( - ln(2) * dt /t_1_2 ) ;
// on l'exprime x 1000
unsigned long K = 916;


void setup() {
  Serial.begin(19200);
  randomSeed(analogRead(0));
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.print(N0);
  t_0 = millis();
}

void loop() {
  while (true) {
    N_i_1 = N_i;
    int i = N_i;
    while (i > 0) {
      i--;
      long p = random(0, 1000);
      if (p > K) {
        N_i_1 = N_i_1 - 1;
      }
    }
    N_i = N_i_1;
    while (millis() - t_0 < dt) {
    }
    t_0 = millis();
    Serial.print(N_i);
  }  
}
