import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// Position calculation function
const getPosition = (trigger, content, placement = 'top', offset = 8) => {
  if (!trigger || !content) return { top: 0, left: 0, opacity: 0 };

  const triggerRect = trigger.getBoundingClientRect();
  const contentRect = content.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;

  let top = 0;
  let left = 0;
  let transform = '';
  let arrowPosition = {};

  switch (placement) {
    case 'top':
      top = triggerRect.top - contentRect.height - offset;
      left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
      transform = 'translateY(-8px)';
      arrowPosition = {
        bottom: -4,
        left: '50%',
        transform: 'translateX(-50%) rotate(45deg)'
      };
      break;
    case 'bottom':
      top = triggerRect.bottom + offset;
      left = triggerRect.left + (triggerRect.width - contentRect.width) / 2;
      transform = 'translateY(8px)';
      arrowPosition = {
        top: -4,
        left: '50%',
        transform: 'translateX(-50%) rotate(45deg)'
      };
      break;
    case 'left':
      top = triggerRect.top + (triggerRect.height - contentRect.height) / 2;
      left = triggerRect.left - contentRect.width - offset;
      transform = 'translateX(-8px)';
      arrowPosition = {
        top: '50%',
        right: -4,
        transform: 'translateY(-50%) rotate(45deg)'
      };
      break;
    case 'right':
      top = triggerRect.top + (triggerRect.height - contentRect.height) / 2;
      left = triggerRect.right + offset;
      transform = 'translateX(8px)';
      arrowPosition = {
        top: '50%',
        left: -4,
        transform: 'translateY(-50%) rotate(45deg)'
      };
      break;
    default:
      break;
  }

  // Adjust for scroll position
  top += scrollY;
  left += scrollX;

  // Ensure the tooltip stays within the viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rightEdge = left + contentRect.width;
  const bottomEdge = top + contentRect.height;

  if (rightEdge > viewportWidth) {
    left = viewportWidth - contentRect.width - 16; // 16px padding
  }
  if (left < 0) {
    left = 16; // 16px padding
  }
  if (bottomEdge > viewportHeight + scrollY) {
    top = triggerRect.top - contentRect.height - offset + scrollY;
  }
  if (top < scrollY) {
    top = triggerRect.bottom + offset + scrollY;
  }

  return { top, left, transform, arrowPosition };
};

const Tooltip = ({
  content,
  children,
  placement = 'top',
  delayDuration = 200,
  open: controlledOpen,
  onOpenChange,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, opacity: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);
  const timeoutRef = useRef(null);
  const isControlled = controlledOpen !== undefined;
  const showTooltip = isControlled ? controlledOpen : isOpen;

  // Handle open/close state
  const handleOpen = () => {
    if (!isControlled) {
      setIsOpen(true);
    }
    onOpenChange?.(true);
  };

  const handleClose = () => {
    if (!isControlled) {
      setIsOpen(false);
    }
    onOpenChange?.(false);
  };

  // Update position when tooltip is shown
  useEffect(() => {
    if (showTooltip && triggerRef.current && contentRef.current) {
      const updatePosition = () => {
        const pos = getPosition(triggerRef.current, contentRef.current, placement);
        setPosition({
          ...pos,
          opacity: 1,
          transition: 'opacity 0.2s ease, transform 0.2s ease'
        });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [showTooltip, placement]);

  // Set mounted state for portal
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Handle hover events with delay
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(handleOpen, delayDuration);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    handleClose();
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Clone the trigger element to add event handlers
  const trigger = React.Children.only(children);
  const triggerWithProps = React.cloneElement(trigger, {
    ref: (node) => {
      triggerRef.current = node;
      // Call the original ref if it exists
      if (trigger && typeof trigger.ref === 'function') {
        trigger.ref(node);
      } else if (trigger && trigger.ref) {
        trigger.ref.current = node;
      }
    },
    onMouseEnter: (e) => {
      handleMouseEnter();
      trigger.props.onMouseEnter?.(e);
    },
    onMouseLeave: (e) => {
      handleMouseLeave();
      trigger.props.onMouseLeave?.(e);
    },
    onFocus: (e) => {
      handleMouseEnter();
      trigger.props.onFocus?.(e);
    },
    onBlur: (e) => {
      handleMouseLeave();
      trigger.props.onBlur?.(e);
    },
  });

  // Only render the portal on the client side
  if (!isMounted) {
    return triggerWithProps;
  }

  return (
    <>
      {triggerWithProps}
      {showTooltip &&
        createPortal(
          <div
            ref={contentRef}
            className="fixed z-50 px-3 py-1.5 text-sm text-white bg-gray-900 rounded-md shadow-lg pointer-events-none"
            style={{
              top: position.top,
              left: position.left,
              opacity: position.opacity,
              transform: position.transform,
              transition: position.transition,
              maxWidth: '300px',
              ...props.style,
            }}
            role="tooltip"
          >
            {content}
            <div
              className="absolute w-2 h-2 bg-gray-900"
              style={position.arrowPosition}
            />
          </div>,
          document.body
        )}
    </>
  );
};

export { Tooltip };

export default Tooltip;
