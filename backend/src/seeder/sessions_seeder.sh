#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3001"
THERAPIST="therapist-001"
CLIENT="client-001"

create_session() {
  local start_time=$1
  curl -s -X POST "$BASE_URL/sessions" \
    -H "Content-Type: application/json" \
    -d "{\"therapistId\":\"$THERAPIST\",\"clientId\":\"$CLIENT\",\"startTime\":\"$start_time\"}" | jq -r '.data.sessionId'
}

add_entry() {
  local session_id=$1 speaker=$2 content=$3 timestamp=$4
  curl -s -X POST "$BASE_URL/sessions/$session_id/entries" \
    -H "Content-Type: application/json" \
    -d "{\"speaker\":\"$speaker\",\"content\":\"$content\",\"timestamp\":\"$timestamp\"}" >/dev/null
  echo "  ✓ Added $speaker entry"
}

echo "Starting comprehensive therapy session seeding..."
echo "================================================"

# ============================================================================
# SESSION 1: Initial Assessment - Work-Related Anxiety (15 entries)
# ============================================================================
echo ""
echo "Creating Session 1: Initial Assessment (15 entries)..."
S1=$(create_session "2024-01-08T10:00:00Z")
add_entry "$S1" therapist "Good morning! Thanks for coming in today. What brings you to therapy?" "2024-01-08T10:00:00Z"
add_entry "$S1" client "I've been feeling really anxious at work lately. It's affecting my sleep and my relationships." "2024-01-08T10:01:00Z"
add_entry "$S1" therapist "I'm sorry to hear that. Can you tell me more about when you first started noticing these feelings?" "2024-01-08T10:02:00Z"
add_entry "$S1" client "It started about three months ago when I got promoted to team lead. Suddenly I'm responsible for five people and multiple projects." "2024-01-08T10:03:00Z"
add_entry "$S1" therapist "That's a significant change. What specific situations trigger your anxiety the most?" "2024-01-08T10:04:00Z"
add_entry "$S1" client "Definitely team meetings and one-on-ones. I'm terrified of saying something wrong or looking incompetent in front of my team." "2024-01-08T10:05:00Z"
add_entry "$S1" therapist "Those sound like challenging situations. On a scale of 1-10, how would you rate your anxiety during these meetings?" "2024-01-08T10:06:00Z"
add_entry "$S1" client "Usually an 8 or 9. Sometimes I feel my heart racing so fast I think people can see it. I start sweating and my voice shakes." "2024-01-08T10:07:00Z"
add_entry "$S1" therapist "Those are classic physical symptoms of anxiety. How has this been impacting your daily life outside of work?" "2024-01-08T10:08:00Z"
add_entry "$S1" client "I'm exhausted all the time. I can't stop thinking about work even at home. My partner says I'm distant and irritable." "2024-01-08T10:09:00Z"
add_entry "$S1" therapist "It sounds like the anxiety is taking a significant toll. Have you tried any coping strategies on your own?" "2024-01-08T10:10:00Z"
add_entry "$S1" client "I've tried deep breathing a few times, but honestly I can't seem to focus on it when I'm really anxious. I also drink more coffee to stay alert, which probably makes it worse." "2024-01-08T10:11:00Z"
add_entry "$S1" therapist "You're right that caffeine can amplify anxiety symptoms. I'd like to work with you using cognitive-behavioral therapy techniques. We'll focus on identifying thought patterns and developing practical coping strategies. Does that sound good?" "2024-01-08T10:12:00Z"
add_entry "$S1" client "Yes, I really need something practical. I can't keep living like this." "2024-01-08T10:13:00Z"
add_entry "$S1" therapist "I understand. For our next session, I'd like you to keep a brief anxiety journal. Just note when you feel anxious, rate it 1-10, and write down what you were thinking. Can you do that?" "2024-01-08T10:14:00Z"

echo "✅ Session 1 completed: $S1"

# ============================================================================
# SESSION 2: Cognitive Distortions & Thought Records (20 entries)
# ============================================================================
echo ""
echo "Creating Session 2: Identifying Cognitive Distortions (20 entries)..."
S2=$(create_session "2024-01-15T10:00:00Z")
add_entry "$S2" therapist "Welcome back! How did the anxiety journal go this week?" "2024-01-15T10:00:00Z"
add_entry "$S2" client "I filled it out most days. I was surprised how often I feel anxious - almost constantly at work." "2024-01-15T10:01:00Z"
add_entry "$S2" therapist "That's really valuable awareness. Let's look at some of the situations you recorded. What was happening during your highest-rated anxiety moment?" "2024-01-15T10:02:00Z"
add_entry "$S2" client "It was a team meeting on Tuesday. I had to present project updates. I rated it a 9." "2024-01-15T10:03:00Z"
add_entry "$S2" therapist "And what thoughts were going through your mind right before and during the presentation?" "2024-01-15T10:04:00Z"
add_entry "$S2" client "I kept thinking 'I'm going to mess this up. Everyone will realize I don't know what I'm doing. They'll think I'm a fraud.'" "2024-01-15T10:05:00Z"
add_entry "$S2" therapist "Those are powerful thoughts. I notice a pattern here called 'catastrophizing' - jumping to the worst possible outcome. Also something called 'mind reading' - assuming you know what others are thinking. Do these sound familiar?" "2024-01-15T10:06:00Z"
add_entry "$S2" client "Yes, actually. I do that a lot. I'm always assuming the worst." "2024-01-15T10:07:00Z"
add_entry "$S2" therapist "What's interesting is these thoughts feel completely true in the moment, right? But let's examine the evidence. What actually happened during that presentation?" "2024-01-15T10:08:00Z"
add_entry "$S2" client "Well... I did finish it. Nobody seemed upset or confused. Actually, one team member asked a good follow-up question." "2024-01-15T10:09:00Z"
add_entry "$S2" therapist "So the catastrophic outcome you predicted didn't happen. Your team engaged with the content. How does that compare to your anxious prediction?" "2024-01-15T10:10:00Z"
add_entry "$S2" client "It's completely different. I was so focused on my anxiety I didn't even notice the positive feedback." "2024-01-15T10:11:00Z"
add_entry "$S2" therapist "That's a crucial insight. Anxiety narrows our focus to threats and makes us ignore contradictory evidence. Let's practice a technique called cognitive restructuring. When you notice a catastrophic thought, we'll challenge it with evidence." "2024-01-15T10:12:00Z"
add_entry "$S2" client "How do I do that in the moment when I'm panicking?" "2024-01-15T10:13:00Z"
add_entry "$S2" therapist "Great question. We'll start with a simple three-step process: First, notice the thought. Second, ask 'What's the evidence?' Third, create a more balanced thought. Let's practice with that meeting example." "2024-01-15T10:14:00Z"
add_entry "$S2" client "Okay, so the thought was 'I'll mess up and look incompetent.' The evidence is... I've done presentations before and they went fine. My manager promoted me, so they must trust my abilities." "2024-01-15T10:15:00Z"
add_entry "$S2" therapist "Excellent! Now create a balanced thought that incorporates that evidence." "2024-01-15T10:16:00Z"
add_entry "$S2" client "Maybe something like 'I might feel nervous, but I'm prepared and my team values my input'?" "2024-01-15T10:17:00Z"
add_entry "$S2" therapist "That's perfect! Notice how it acknowledges the nervousness without catastrophizing. For homework, I want you to use this three-step process whenever you notice catastrophic thinking. Write down at least three examples for next week." "2024-01-15T10:18:00Z"
add_entry "$S2" client "I can do that. This actually makes sense to me." "2024-01-15T10:19:00Z"

echo "✅ Session 2 completed: $S2"

# ============================================================================
# SESSION 3: Progressive Muscle Relaxation & Exposure Hierarchy (30 entries)
# ============================================================================
echo ""
echo "Creating Session 3: Relaxation Techniques & Exposure Planning (30 entries)..."
S3=$(create_session "2024-01-22T10:00:00Z")
add_entry "$S3" therapist "Good to see you again! How did the cognitive restructuring homework go?" "2024-01-22T10:00:00Z"
add_entry "$S3" client "It was harder than I expected but I did it. I caught myself catastrophizing about four times and wrote them down." "2024-01-22T10:01:00Z"
add_entry "$S3" therapist "That's excellent work. Just noticing the thoughts is half the battle. Let's review one or two examples." "2024-01-22T10:02:00Z"
add_entry "$S3" client "One was on Thursday. I had to give feedback to one of my team members who missed a deadline. My immediate thought was 'This will be a disaster. They'll hate me and the whole team will turn against me.'" "2024-01-22T10:03:00Z"
add_entry "$S3" therapist "Classic catastrophizing again. What did you do with that thought?" "2024-01-22T10:04:00Z"
add_entry "$S3" client "I used your three-step process. I looked at the evidence: I've given feedback before and people appreciated the honesty. This person seems professional. Then I reframed it to 'This might be uncomfortable, but clear feedback helps them grow and improves the team.'" "2024-01-22T10:05:00Z"
add_entry "$S3" therapist "That's really impressive reframing. What happened in reality?" "2024-01-22T10:06:00Z"
add_entry "$S3" client "They actually thanked me for being direct and asked how they could improve their time management. It went way better than my anxiety predicted." "2024-01-22T10:07:00Z"
add_entry "$S3" therapist "Perfect example of how our anxious predictions rarely match reality. Now, I want to add another tool to your toolkit - progressive muscle relaxation. This helps with the physical symptoms you mentioned." "2024-01-22T10:08:00Z"
add_entry "$S3" client "The racing heart and sweating? Yes, those are still really bad." "2024-01-22T10:09:00Z"
add_entry "$S3" therapist "Exactly. When we're anxious, our muscles tense up without us realizing it. This technique teaches you to recognize and release that tension. Let's try it now. Get comfortable in your chair." "2024-01-22T10:10:00Z"
add_entry "$S3" client "Okay, I'm ready." "2024-01-22T10:11:00Z"
add_entry "$S3" therapist "We'll start with your hands. Make tight fists and hold for 5 seconds... notice the tension... now release and feel the difference. Notice how your hands feel warm and heavy." "2024-01-22T10:12:00Z"
add_entry "$S3" client "Wow, I didn't realize how tense they were until I let go." "2024-01-22T10:13:00Z"
add_entry "$S3" therapist "That's the key insight. Now let's move to your shoulders. Pull them up toward your ears... hold... and release. Feel them drop and relax." "2024-01-22T10:14:00Z"
add_entry "$S3" client "That feels really good. My shoulders are always tight." "2024-01-22T10:15:00Z"
add_entry "$S3" therapist "We'll continue through your whole body - jaw, forehead, chest, stomach, legs. The full sequence takes about 15 minutes. I'll give you a recording to practice at home. Try it daily, and especially before stressful situations." "2024-01-22T10:16:00Z"
add_entry "$S3" client "I can definitely do that. Fifteen minutes seems manageable." "2024-01-22T10:17:00Z"
add_entry "$S3" therapist "Great. Now I want to introduce something called exposure therapy. You mentioned avoiding certain situations due to anxiety. Can you list some situations you avoid or find extremely difficult?" "2024-01-22T10:18:00Z"
add_entry "$S3" client "Um, speaking up in large meetings. One-on-one feedback sessions. Having lunch with the team. Basically anything social at work." "2024-01-22T10:19:00Z"
add_entry "$S3" therapist "Those are all important activities for a team lead. Avoidance gives temporary relief but makes anxiety stronger over time. We're going to create an exposure hierarchy - ranking these from least to most anxiety-provoking." "2024-01-22T10:20:00Z"
add_entry "$S3" client "Ranking them? From easiest to hardest?" "2024-01-22T10:21:00Z"
add_entry "$S3" therapist "Exactly. Rate each situation 0-100 for how much anxiety it causes. We'll start with lower-rated situations and gradually work up." "2024-01-22T10:22:00Z"
add_entry "$S3" client "Okay... having lunch with one person from the team is maybe a 40. Small group lunch is 60. Speaking up in a meeting with 5-10 people is 75. Large all-hands meetings are 95." "2024-01-22T10:23:00Z"
add_entry "$S3" therapist "Perfect hierarchy. We'll start with the 40-rated situation. Your homework this week is to have lunch with one team member. Before you go, practice your muscle relaxation. During lunch, notice your anxiety level and any catastrophic thoughts." "2024-01-22T10:24:00Z"
add_entry "$S3" client "Just one person? I think I can do that. Though I'm already nervous thinking about it." "2024-01-22T10:25:00Z"
add_entry "$S3" therapist "That's completely normal. The anxiety will be highest before and at the start. It typically peaks around 10-15 minutes in, then starts decreasing naturally. Your brain realizes there's no actual threat." "2024-01-22T10:26:00Z"
add_entry "$S3" client "So I just have to push through that initial peak?" "2024-01-22T10:27:00Z"
add_entry "$S3" therapist "Exactly. And use your cognitive restructuring. What's a balanced thought you could use before this lunch?" "2024-01-22T10:28:00Z"
add_entry "$S3" client "'I might feel uncomfortable at first, but anxiety decreases with time. This person is my colleague, not a threat.'" "2024-01-22T10:29:00Z"

echo "✅ Session 3 completed: $S3"

# ============================================================================
# SESSION 4: Deeper Exploration - Core Beliefs & Safety Behaviors (40 entries)
# ============================================================================
echo ""
echo "Creating Session 4: Core Beliefs & Safety Behaviors (40 entries)..."
S4=$(create_session "2024-01-29T10:00:00Z")
add_entry "$S4" therapist "Welcome back! I'm eager to hear about your exposure homework. Did you have lunch with a team member?" "2024-01-29T10:00:00Z"
add_entry "$S4" client "I did! I invited Sarah from the design team. I was really nervous beforehand - probably a 7 out of 10." "2024-01-29T10:01:00Z"
add_entry "$S4" therapist "That's already an accomplishment - you followed through despite the anxiety. How did it go?" "2024-01-29T10:02:00Z"
add_entry "$S4" client "At first it was awkward. I could feel my heart pounding. But after about 15 minutes, just like you said, it got easier. We ended up talking about our weekend plans and a TV show we both watch." "2024-01-29T10:03:00Z"
add_entry "$S4" therapist "That's excellent! The anxiety peaked and then decreased naturally. What was your anxiety level by the end?" "2024-01-29T10:04:00Z"
add_entry "$S4" client "Maybe a 3? It was actually... nice. I forgot how much I used to enjoy connecting with coworkers before all this anxiety started." "2024-01-29T10:05:00Z"
add_entry "$S4" therapist "That's a powerful realization. The avoidance was protecting you from anxiety but also cutting you off from positive experiences. Did you notice any catastrophic thoughts during lunch?" "2024-01-29T10:06:00Z"
add_entry "$S4" client "At the beginning, yes. I thought 'I won't know what to say. There will be awkward silences. She'll think I'm boring.' But none of that happened." "2024-01-29T10:07:00Z"
add_entry "$S4" therapist "More evidence that your anxious predictions don't match reality. I'm noticing a pattern in your thoughts - they all center around being judged negatively. 'I'm incompetent, boring, a fraud.' Let's dig deeper into where these beliefs come from." "2024-01-29T10:08:00Z"
add_entry "$S4" client "I've always been hard on myself. My parents had really high expectations." "2024-01-29T10:09:00Z"
add_entry "$S4" therapist "Tell me more about that. What were their expectations like?" "2024-01-29T10:10:00Z"
add_entry "$S4" client "My dad was a surgeon. He always said 'second best is first loser.' I had to get straight A's, be first chair violin, captain of the debate team. Anything less was disappointing." "2024-01-29T10:11:00Z"
add_entry "$S4" therapist "That sounds like tremendous pressure for a child. How did you feel when you didn't meet those expectations?" "2024-01-29T10:12:00Z"
add_entry "$S4" client "Terrible. Like I was letting everyone down. I remember getting a B+ in chemistry and my dad didn't speak to me for two days. I felt like I wasn't good enough, that I had failed." "2024-01-29T10:13:00Z"
add_entry "$S4" therapist "That must have been painful. It sounds like you internalized the message that your worth was tied to perfect performance. Do you see how that might connect to your current anxiety about work?" "2024-01-29T10:14:00Z"
add_entry "$S4" client "Oh... yeah. I'm still operating under that rule. Any mistake means I'm worthless. Any sign of not being the absolute best means I'm a failure." "2024-01-29T10:15:00Z"
add_entry "$S4" therapist "Exactly. We call this a 'core belief' - a deep-seated assumption about yourself that colors everything. Your core belief seems to be 'I must be perfect or I'm worthless.' But beliefs formed in childhood aren't necessarily true or helpful now." "2024-01-29T10:16:00Z"
add_entry "$S4" client "So how do I change it? It feels like it's just part of who I am." "2024-01-29T10:17:00Z"
add_entry "$S4" therapist "It's part of your current thinking pattern, but not your unchangeable identity. We challenge core beliefs the same way we challenged catastrophic thoughts - with evidence. What evidence contradicts 'I must be perfect or I'm worthless'?" "2024-01-29T10:18:00Z"
add_entry "$S4" client "Um... my manager promoted me even though I'm not perfect? My team seems to respect me despite my mistakes? My partner loves me?" "2024-01-29T10:19:00Z"
add_entry "$S4" therapist "All strong evidence! Your worth clearly isn't dependent on perfection. What would be a more balanced core belief?" "2024-01-29T10:20:00Z"
add_entry "$S4" client "Maybe... 'I'm valuable even when I make mistakes. Growth is more important than perfection.'" "2024-01-29T10:21:00Z"
add_entry "$S4" therapist "That's beautiful. Now, changing core beliefs takes time and consistent practice. Each time you notice the old belief ('I must be perfect'), pause and remind yourself of the new belief. Write it somewhere you'll see daily." "2024-01-29T10:22:00Z"
add_entry "$S4" client "I can put it on my bathroom mirror and my computer desktop." "2024-01-29T10:23:00Z"
add_entry "$S4" therapist "Perfect. Now let's talk about something called safety behaviors. These are subtle things we do to try to prevent the catastrophe we fear. What do you do before or during stressful work situations?" "2024-01-29T10:24:00Z"
add_entry "$S4" client "Before meetings, I over-prepare. Like, I'll rehearse what I'm going to say 20 times. I write out every word on notecards." "2024-01-29T10:25:00Z"
add_entry "$S4" therapist "What else?" "2024-01-29T10:26:00Z"
add_entry "$S4" client "In meetings, I sit in the back or corner if I can. I avoid eye contact so I won't get called on. I speak really fast to get through it quickly." "2024-01-29T10:27:00Z"
add_entry "$S4" therapist "Those are all classic safety behaviors. They feel helpful because they reduce anxiety temporarily, but they actually maintain it long-term. They prevent you from learning that you're safe without them." "2024-01-29T10:28:00Z"
add_entry "$S4" client "So I shouldn't prepare for meetings?" "2024-01-29T10:29:00Z"
add_entry "$S4" therapist "Reasonable preparation is fine - outlining key points, reviewing data. But rehearsing 20 times and memorizing scripts is excessive. It reinforces the belief that you can't handle uncertainty. Same with avoiding eye contact - it prevents you from seeing that people's reactions aren't actually threatening." "2024-01-29T10:30:00Z"
add_entry "$S4" client "This is hard to hear. Those behaviors are the only things that make me feel safe." "2024-01-29T10:31:00Z"
add_entry "$S4" therapist "I understand that. We'll reduce them gradually, not all at once. For next week, pick one safety behavior to experiment with dropping. Maybe prepare for a meeting normally instead of excessively, or sit in your usual spot instead of hiding in the back." "2024-01-29T10:32:00Z"
add_entry "$S4" client "Sitting in my usual spot sounds slightly less terrifying than under-preparing." "2024-01-29T10:33:00Z"
add_entry "$S4" therapist "Great choice. Notice what happens - does the catastrophe occur? What do you learn about your ability to cope? Also, continue your exposure homework. This week, try a small group lunch - maybe 3-4 people." "2024-01-29T10:34:00Z"
add_entry "$S4" client "Moving up the hierarchy. Okay, I can try that." "2024-01-29T10:35:00Z"
add_entry "$S4" therapist "You're doing really well. I know this feels overwhelming, but you're making significant progress. Your awareness of your thought patterns, your willingness to challenge them, and your courage to face feared situations - that's what change looks like." "2024-01-29T10:36:00Z"
add_entry "$S4" client "Thank you. I needed to hear that. Sometimes I feel like I'm not making progress because I still feel anxious." "2024-01-29T10:37:00Z"
add_entry "$S4" therapist "The goal isn't to eliminate anxiety - it's a normal human emotion. The goal is to stop letting it control your choices. You had lunch despite anxiety. You're going to drop a safety behavior despite anxiety. That's progress." "2024-01-29T10:38:00Z"
add_entry "$S4" client "That actually makes me feel better. I thought something was wrong with me because the anxiety wasn't gone yet." "2024-01-29T10:39:00Z"

echo "✅ Session 4 completed: $S4"

# ============================================================================
# SESSION 5: Comprehensive Session - Relapse Prevention & Integration (50 entries)
# ============================================================================
echo ""
echo "Creating Session 5: Comprehensive Review & Relapse Prevention (50 entries)..."
S5=$(create_session "2024-02-05T10:00:00Z")
add_entry "$S5" therapist "Welcome! We've been working together for a month now. I'd like to use today's session to review your progress and create a relapse prevention plan. How are you feeling overall?" "2024-02-05T10:00:00Z"
add_entry "$S5" client "Honestly? Better than I have in months. Not perfect, but definitely better. I actually feel hopeful." "2024-02-05T10:01:00Z"
add_entry "$S5" therapist "That's wonderful to hear. Let's start by reviewing what you accomplished this past week. Did you drop a safety behavior?" "2024-02-05T10:02:00Z"
add_entry "$S5" client "Yes! I had two meetings this week. In the first one, I sat in my usual spot instead of hiding in the back. My anxiety was high at first - probably an 8." "2024-02-05T10:03:00Z"
add_entry "$S5" therapist "That took courage. What happened?" "2024-02-05T10:04:00Z"
add_entry "$S5" client "It was weird. I kept expecting someone to call me out or ask me a question I couldn't answer. But... nothing bad happened. I contributed twice and people seemed to listen." "2024-02-05T10:05:00Z"
add_entry "$S5" therapist "Excellent. Did you notice any difference in the second meeting?" "2024-02-05T10:06:00Z"
add_entry "$S5" client "Actually yes! The anxiety started at a 6 instead of an 8, and it dropped to a 3 pretty quickly. I even made a joke and people laughed." "2024-02-05T10:07:00Z"
add_entry "$S5" therapist "That's a perfect example of habituation - your brain is learning that sitting in your usual spot isn't dangerous. The anxiety decreases with repeated exposure. How about the group lunch?" "2024-02-05T10:08:00Z"
add_entry "$S5" client "I did it! Four of us went to lunch on Wednesday. I was nervous but I remembered what you said about anxiety peaking and then decreasing." "2024-02-05T10:09:00Z"
add_entry "$S5" therapist "What was your anxiety level throughout?" "2024-02-05T10:10:00Z"
add_entry "$S5" client "Started at 6, peaked at maybe 7 in the first ten minutes, then gradually went down to a 2. By the end we were laughing about a project disaster from last year." "2024-02-05T10:11:00Z"
add_entry "$S5" therapist "That's significant progress from where we started. Do you remember your initial assessment? You were avoiding all social situations at work and rating your anxiety as 8 or 9 constantly." "2024-02-05T10:12:00Z"
add_entry "$S5" client "I know. Looking back, I can't believe how much I was avoiding. It was exhausting and lonely." "2024-02-05T10:13:00Z"
add_entry "$S5" therapist "Let's map out your progress systematically. At the beginning, you identified several situations on your exposure hierarchy. Where do you stand with each one now?" "2024-02-05T10:14:00Z"
add_entry "$S5" client "One-on-one lunch was a 40, now it's maybe a 15. Small group lunch was 60, now it's around 25. I haven't tried speaking up in a large meeting yet - that's still probably a 70." "2024-02-05T10:15:00Z"
add_entry "$S5" therapist "So you've made substantial progress on the lower hierarchy items. That's exactly how it should work - building confidence on easier exposures before tackling harder ones. The large meeting is our next target." "2024-02-05T10:16:00Z"
add_entry "$S5" client "I'm nervous about that one. There are like 30 people in our all-hands meetings." "2024-02-05T10:17:00Z"
add_entry "$S5" therapist "We'll break it down into steps. First, just attend and make eye contact with the speaker. Then maybe type a question in the chat. Then ask a brief verbal question. We don't jump straight to giving a presentation." "2024-02-05T10:18:00Z"
add_entry "$S5" client "That actually sounds manageable when you break it down like that." "2024-02-05T10:19:00Z"
add_entry "$S5" therapist "Good. Now let's talk about cognitive changes. When we started, you were catastrophizing frequently - jumping to worst-case scenarios. How often do you catch yourself doing that now?" "2024-02-05T10:20:00Z"
add_entry "$S5" client "I still do it, but I notice it much faster now. Sometimes I catch it before it spirals. Like yesterday, I started thinking 'This presentation will be a disaster,' but I immediately thought 'Wait, that's catastrophizing. What's the evidence?'" "2024-01-29T10:21:00Z"
add_entry "$S5" therapist "That's exactly what we want - automatic recognition and challenge of distorted thoughts. What evidence did you come up with?" "2024-02-05T10:22:00Z"
add_entry "$S5" client "My last three presentations went fine. I'm prepared. Even if something goes wrong, I can handle it. The world won't end." "2024-02-05T10:23:00Z"
add_entry "$S5" therapist "Perfect reframe. You're also seeing evidence of another cognitive shift - from 'I can't handle this' to 'I can handle this.' That's increased self-efficacy. How's your confidence in managing anxiety overall?" "2024-02-05T10:24:00Z"
add_entry "$S5" client "Much better. I actually used the progressive muscle relaxation before both meetings this week. It really helps ground me." "2024-02-05T10:25:00Z"
add_entry "$S5" therapist "Excellent. You're building a toolkit of strategies. Let's list what's working for you: cognitive restructuring, exposure, muscle relaxation. Anything else?" "2024-02-05T10:26:00Z"
add_entry "$S5" client "I started reducing my coffee intake like we discussed. Down from 5 cups to 2 cups before noon. I sleep better and I'm less jittery." "2024-02-05T10:27:00Z"
add_entry "$S5" therapist "That's a huge lifestyle change that supports your therapy work. How about your relationship with your partner? You mentioned being distant and irritable at the start." "2024-02-05T10:28:00Z"
add_entry "$S5" client "That's actually improved a lot. I'm not bringing work stress home as much. We had a conversation about my therapy and what I'm working on, and they've been really supportive." "2024-02-05T10:29:00Z"
add_entry "$S5" therapist "I'm glad to hear that. Social support is crucial for maintaining progress. Now, let's talk about relapse prevention. Anxiety isn't something we cure permanently - it's something we manage. There will be times when it increases again." "2024-02-05T10:30:00Z"
add_entry "$S5" client "That's a little scary to hear. I don't want to go back to how I was." "2024-02-05T10:31:00Z"
add_entry "$S5" therapist "You won't, because now you have skills and awareness you didn't have before. But life will throw challenges - a new stressor, a setback at work, illness. We want to prepare for that. What early warning signs might indicate your anxiety is increasing?" "2024-02-05T10:32:00Z"
add_entry "$S5" client "Probably avoiding social situations again. Not sleeping well. Catastrophizing without catching it." "2024-02-05T10:33:00Z"
add_entry "$S5" therapist "Perfect awareness. Those are your red flags. When you notice them, what should you do?" "2024-02-05T10:34:00Z"
add_entry "$S5" client "Use my strategies? Do more muscle relaxation, challenge my thoughts, force myself to engage instead of avoid?" "2024-02-05T10:35:00Z"
add_entry "$S5" therapist "Exactly. And don't hesitate to schedule a session if you need support. Early intervention prevents small setbacks from becoming major relapses. Let's also identify high-risk situations - times when anxiety is more likely to spike." "2024-02-05T10:36:00Z"
add_entry "$S5" client "Probably any major change at work. New responsibilities, team changes, conflict with my manager. Also if I'm physically rundown - sick or not sleeping." "2024-02-05T10:37:00Z"
add_entry "$S5" therapist "Great insight. Physical health affects mental health. During high-risk times, increase your coping strategies proactively. More relaxation practice, more cognitive work, reaching out for support. Don't wait until you're in crisis." "2024-02-05T10:38:00Z"
add_entry "$S5" client "That makes sense. Be preventative instead of reactive." "2024-02-05T10:39:00Z"
add_entry "$S5" therapist "Exactly. Now let's talk about your core belief work. Remember identifying 'I must be perfect or I'm worthless'? How has that shifted?" "2024-02-05T10:40:00Z"
add_entry "$S5" client "I've been repeating the new belief daily: 'I'm valuable even when I make mistakes. Growth is more important than perfection.' It's starting to feel more natural." "2024-02-05T10:41:00Z"
add_entry "$S5" therapist "Can you give me an example of when you acted in line with the new belief instead of the old one?" "2024-02-05T10:42:00Z"
add_entry "$S5" client "Yes! I made a mistake in a project timeline estimate. Old me would have spiraled, thinking I'm incompetent and everyone will lose respect for me. Instead, I caught myself, acknowledged the mistake to my team, proposed a solution, and moved on. It was uncomfortable but not catastrophic." "2024-02-05T10:43:00Z"
add_entry "$S5" therapist "That's incredible growth. You modeled healthy leadership - owning mistakes and focusing on solutions. How did your team react?" "2024-02-05T10:44:00Z"
add_entry "$S5" client "They actually seemed impressed that I addressed it directly. One person said they appreciated my transparency. It was the opposite of what my anxious brain predicted." "2024-02-05T10:45:00Z"
add_entry "$S5" therapist "More evidence that your new belief serves you better than the old one. As we wrap up today, I want you to reflect on what you're most proud of from the past month." "2024-02-05T10:46:00Z"
add_entry "$S5" client "I think... having lunch with my team and actually enjoying it. A month ago I couldn't imagine doing that. It showed me that I can face my fears and come out okay on the other side." "2024-02-05T10:47:00Z"
add_entry "$S5" therapist "That is something to be proud of. You've done hard, brave work. For the next two weeks, continue practicing your exposures - try speaking up in a larger meeting. Keep using cognitive restructuring. And schedule a follow-up session in two weeks so we can check in on progress." "2024-02-05T10:48:00Z"
add_entry "$S5" client "I will. Thank you for all your help. I feel like I'm getting my life back." "2024-02-05T10:49:00Z"

echo "✅ Session 5 completed: $S5"

echo ""
echo "================================================"
echo "✅ All sessions created successfully!"
echo "================================================"
echo ""
echo "Session Summary:"
echo "  S1 (15 entries): Initial Assessment - $S1"
echo "  S2 (20 entries): Cognitive Distortions - $S2"
echo "  S3 (30 entries): Relaxation & Exposure - $S3"
echo "  S4 (40 entries): Core Beliefs - $S4"
echo "  S5 (50 entries): Comprehensive Review - $S5"
echo ""
echo "Total: 155 therapy session entries created!"
echo "================================================"
