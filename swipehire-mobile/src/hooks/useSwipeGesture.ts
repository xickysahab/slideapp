import { useEffect } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  Extrapolation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { tokens } from '../theme/tokens';
import type { SwipeDirection } from '../types';

/**
 * Core swipe gesture — Frontend Spec §7.
 *
 * Everything here runs on the UI thread: the pan callbacks and the animated styles are worklets, so
 * a drag never round-trips through JS. Only the committed-swipe callbacks cross back over via
 * `runOnJS`. This is the difference between a deck that feels like paper and one that feels like a
 * web page, and Demo CLAUDE §2 names it one of the two things not to compromise on.
 *
 * Demo scope: left (pass) and right (shortlist) only. The spec's drag-up Fast-Track gesture is out
 * of scope for this build (Demo PRD §2 row 15), so there is no up-threshold and no third stamp.
 */

/** Release past this fraction of the screen width commits the swipe (§7.1). */
export const SWIPE_THRESHOLD_RATIO = 0.28;
/** …or fling faster than this, in px/s, regardless of distance (§7.1). */
export const VELOCITY_THRESHOLD = 800;
/** Max card tilt during the follow phase (§7.2). */
export const MAX_ROTATION_DEG = 8;
/** Committed swipe flies out over this long (§7.2). */
export const EXIT_DURATION_MS = 400;

/**
 * Spec conflict, resolved deliberately: the token block's `motion.spring` is commented
 * "card promotion / undo" at damping 18 / stiffness 180, but §7.2 specifies damping 15 /
 * stiffness 150 for the undo (snap-back) case specifically. §7.2 is the more specific statement, so
 * snap-back uses 15/150 and card promotion uses the token's 18/180. Both are overshoot-free, which
 * is the property §7.2 actually cares about.
 */
const SNAP_BACK_SPRING = { damping: 15, stiffness: 150, mass: tokens.motion.spring.mass } as const;

/**
 * Resting transform for each slot in the 3-card rolling window (§8): the two cards behind the top
 * one sit scaled back and nudged down so the promotion animation has no layout jump.
 *
 * Spec conflict, resolved: §8 puts the stacked cards at 0.96 / 0.92, while §7.2 describes the
 * promotion as scaling "from 0.94 → 1.0". Both can't hold. §8 is the specific statement about the
 * rolling window, so the resting scales are 0.96/0.92 and a promoting card animates 0.96 → 1.0.
 */
const STACK_SCALE = [1, 0.96, 0.92] as const;
const STACK_OFFSET = [0, tokens.spacing.sm, tokens.spacing.sm * 2] as const;

export interface UseSwipeGestureArgs {
  cardWidth: number;
  cardHeight: number;
  screenWidth: number;
  onSwipe: (direction: SwipeDirection) => void;
  /** Disables dragging — used for the cards stacked behind the top one. */
  enabled?: boolean;
  /** 0 = top/interactive, 1 = next, 2 = next+1. */
  stackPosition?: number;
}

export function useSwipeGesture({
  cardWidth,
  cardHeight,
  screenWidth,
  onSwipe,
  enabled = true,
  stackPosition = 0,
}: UseSwipeGestureArgs) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const thresholdX = screenWidth * SWIPE_THRESHOLD_RATIO;

  const gesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const right = e.translationX > thresholdX || e.velocityX > VELOCITY_THRESHOLD;
      const left = e.translationX < -thresholdX || e.velocityX < -VELOCITY_THRESHOLD;

      if (right || left) {
        const direction: SwipeDirection = right ? 'right' : 'left';
        runOnJS(onSwipe)(direction);
        translateX.value = withTiming(screenWidth * 1.2 * (right ? 1 : -1), {
          duration: EXIT_DURATION_MS,
          easing: Easing.out(Easing.quad),
        });
      } else {
        translateX.value = withSpring(0, SNAP_BACK_SPRING);
        translateY.value = withSpring(0, SNAP_BACK_SPRING);
      }
    });

  const restScale = STACK_SCALE[Math.min(stackPosition, STACK_SCALE.length - 1)];
  const restOffset = STACK_OFFSET[Math.min(stackPosition, STACK_OFFSET.length - 1)];

  /**
   * The stack transform lives in its own shared values, animated here rather than inside the
   * animated style.
   *
   * `withSpring()` returns an animation descriptor, not a number — so it can only be *assigned* to
   * a shared value, never used inside an expression. Writing `translateY.value + withSpring(...)`
   * type-checks and bundles fine, then fails at runtime with "Transform with key of translateY must
   * be number or a percentage". Driving the springs here keeps the style doing plain arithmetic on
   * plain numbers.
   */
  const stackScale = useSharedValue(restScale);
  const stackOffset = useSharedValue(restOffset);

  useEffect(() => {
    stackScale.value = withSpring(restScale, tokens.motion.spring);
    stackOffset.value = withSpring(restOffset, tokens.motion.spring);
  }, [restScale, restOffset, stackScale, stackOffset]);

  /**
   * Drag and stack transforms have to be produced by a *single* animated style — two styles each
   * setting `transform` would clobber each other rather than compose.
   *
   * The card pivots from the bottom corner *opposite* the drag, so it flicks off a table rather
   * than spinning in place (§7.2). React Native rotates about the view centre, so the pivot is
   * moved into place by translating out, rotating, and translating back.
   *
   * The stack springs are driven above; this style just reads their current values.
   */
  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-screenWidth / 2, screenWidth / 2],
      [-MAX_ROTATION_DEG, MAX_ROTATION_DEG],
      Extrapolation.CLAMP,
    );

    const pivotX = translateX.value >= 0 ? -cardWidth / 2 : cardWidth / 2;
    const pivotY = cardHeight / 2;

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + stackOffset.value },
        { translateX: pivotX },
        { translateY: pivotY },
        { rotate: `${rotate}deg` },
        { translateX: -pivotX },
        { translateY: -pivotY },
        { scale: stackScale.value },
      ],
    };
  });

  const shortlistStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, thresholdX], [0, 1], Extrapolation.CLAMP),
  }));

  const passStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -thresholdX], [0, 1], Extrapolation.CLAMP),
  }));

  /** Fires the exit animation from a button press rather than a drag (accessibility path, §12). */
  const swipeProgrammatically = (direction: SwipeDirection) => {
    onSwipe(direction);
    translateX.value = withTiming(screenWidth * 1.2 * (direction === 'right' ? 1 : -1), {
      duration: EXIT_DURATION_MS,
      easing: Easing.out(Easing.quad),
    });
  };

  return { gesture, cardStyle, passStampStyle, shortlistStampStyle, swipeProgrammatically };
}
